import PDFDocument from 'pdfkit';
import { Context, ContextFactoryOptions, ContextImageOptions, ContextTextOptions } from '@vmprint/contracts';
import { Buffer } from 'buffer';
type PdfDocumentInitOptions = NonNullable<ConstructorParameters<typeof PDFDocument>[0]>;

type PdfValues = string | number | boolean | symbol | object | undefined | null;

// Minimal interface compatible with both Node.js streams and browser implementations like blob-stream
export interface PdfWritableStream {
    write(chunk: any, encoding?: string, callback?: (error?: Error | null) => void): boolean;
    write(chunk: any, cb?: (error?: Error | null) => void): boolean;
    end(cb?: () => void): this;
    end(chunk: any, cb?: () => void): this;
    end(chunk: any, encoding?: string, cb?: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    [key: string]: any; // Allow other properties for flexibility
}

export class PdfContext implements Context {
    private doc: InstanceType<typeof PDFDocument>;
    private outputStream: PdfWritableStream | null = null;

    constructor(outputStreamOrOptions: PdfWritableStream | ContextFactoryOptions, options?: ContextFactoryOptions) {
        let actualOptions: ContextFactoryOptions;
        let outputStream: PdfWritableStream | null = null;

        if (outputStreamOrOptions && typeof (outputStreamOrOptions as PdfWritableStream).write === 'function') {
            outputStream = outputStreamOrOptions as PdfWritableStream;
            actualOptions = options!;
            this.outputStream = outputStream;
        } else {
            actualOptions = outputStreamOrOptions as ContextFactoryOptions;
        }

        this.doc = new PDFDocument({
            autoFirstPage: actualOptions.autoFirstPage,
            bufferPages: actualOptions.bufferPages,
            size: actualOptions.size as PdfDocumentInitOptions['size'],
            margins: actualOptions.margins
        });

        if (outputStream) {
            this.doc.pipe(outputStream as NodeJS.WritableStream);
        }
    }

    addPage(): void {
        this.doc.addPage();
    }

    pipe(stream: PdfWritableStream): void {
        this.doc.pipe(stream as NodeJS.WritableStream);
    }

    private isEnded: boolean = false;

    end(): void {
        if (this.isEnded) return;
        this.isEnded = true;
        this.doc.end();
    }

    async registerFont(id: string, buffer: Uint8Array): Promise<void> {
        try {
            this.doc.registerFont(id, Buffer.from(buffer));
        } catch (e: unknown) {
            throw new Error(`[PdfContext] Failed to register font "${id}": ${String(e)}`);
        }
    }

    font(family: string, size?: number): this {
        this.doc.font(family);
        if (size !== undefined) {
            this.doc.fontSize(size);
        }
        return this;
    }

    fontSize(size: number): this {
        this.doc.fontSize(size);
        return this;
    }

    save(): void {
        this.doc.save();
    }

    restore(): void {
        this.doc.restore();
    }

    translate(x: number, y: number): this {
        this.doc.translate(x, y);
        return this;
    }

    rotate(angle: number, originX?: number, originY?: number): this {
        if (Number.isFinite(originX) && Number.isFinite(originY)) {
            this.doc.rotate(angle, { origin: [Number(originX), Number(originY)] });
        } else {
            this.doc.rotate(angle);
        }
        return this;
    }

    opacity(opacity: number): this {
        this.doc.opacity(opacity);
        return this;
    }

    fillColor(color: string): this {
        this.doc.fillColor(color);
        return this;
    }

    strokeColor(color: string): this {
        this.doc.strokeColor(color);
        return this;
    }

    lineWidth(width: number): this {
        this.doc.lineWidth(width);
        return this;
    }

    dash(length: number, options?: { space: number }): this {
        this.doc.dash(length, options);
        return this;
    }

    undash(): this {
        this.doc.undash();
        return this;
    }

    moveTo(x: number, y: number): this {
        this.doc.moveTo(x, y);
        return this;
    }

    lineTo(x: number, y: number): this {
        this.doc.lineTo(x, y);
        return this;
    }

    bezierCurveTo(
        cp1x: number,
        cp1y: number,
        cp2x: number,
        cp2y: number,
        x: number,
        y: number
    ): this {
        this.doc.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        return this;
    }

    rect(x: number, y: number, w: number, h: number): this {
        this.doc.rect(x, y, w, h);
        return this;
    }

    roundedRect(x: number, y: number, w: number, h: number, r: number): this {
        this.doc.roundedRect(x, y, w, h, r);
        return this;
    }

    fill(rule?: 'nonzero' | 'evenodd'): this {
        this.doc.fill(rule);
        return this;
    }

    stroke(): this {
        this.doc.stroke();
        return this;
    }

    fillAndStroke(fillColor?: string, strokeColor?: string): this {
        if (fillColor && strokeColor) {
            this.doc.fillAndStroke(fillColor, strokeColor);
        } else if (fillColor) {
            this.doc.fill(fillColor);
        } else if (strokeColor) {
            this.doc.stroke(strokeColor);
        }
        return this;
    }

    text(str: string, x: number, y: number, options?: ContextTextOptions): this {
        let opts: ContextTextOptions | undefined = options;
        const ascent = Number(options?.ascent);
        if (Number.isFinite(ascent)) {
            const docAny = this.doc as any;
            const fontSize = Number(docAny?._fontSize) || 12;
            const baselinePx = (ascent / 1000) * fontSize;
            opts = { ...(options || {}), baseline: -baselinePx } as any;
        }

        this.doc.text(str, x, y, opts as any);
        return this;
    }

    image(source: string | Uint8Array, x: number, y: number, options?: ContextImageOptions): this {
        const imageSource = typeof source === 'string' ? source : Buffer.from(source);
        this.doc.image(imageSource as any, x, y, {
            width: options?.width,
            height: options?.height
        });
        return this;
    }

    getSize(): { width: number; height: number } {
        const { width, height } = this.doc.page;
        return { width, height };
    }

    waitForFinish(): Promise<void> {
        const documentDone = new Promise<void>((resolve, reject) => {
            this.doc.once('end', resolve);
            this.doc.once('error', reject);
        });

        const stream = this.outputStream as any;
        if (!stream) {
            return documentDone;
        }

        const streamDone = new Promise<void>((resolve, reject) => {
            const finishNow = stream?.writableFinished === true;
            if (finishNow) {
                resolve();
                return;
            }

            const done = () => resolve();
            stream.once('finish', done);
            stream.once('error', reject);
        });

        return Promise.all([documentDone, streamDone]).then(() => undefined);
    }
}

export default PdfContext;
