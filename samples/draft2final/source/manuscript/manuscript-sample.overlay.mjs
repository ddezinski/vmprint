const MARGIN = 72;
const HEADER_Y = 36;
const BASELINE_STEP = 24;
const CHAPTER_TARGET_Y = MARGIN + 216;

function drawMarginFrame(page, ctx) {
  const contentX = MARGIN;
  const contentY = MARGIN;
  const contentW = page.width - (MARGIN * 2);
  const contentH = page.height - (MARGIN * 2);

  ctx.save();
  ctx.strokeColor('#ef4444').lineWidth(0.6);
  ctx.rect(contentX, contentY, contentW, contentH).stroke();
  ctx.restore();
}

function drawHeaderGuide(page, ctx) {
  ctx.save();
  ctx.strokeColor('#2563eb').lineWidth(0.5).dash(3, { space: 3 });
  ctx.moveTo(MARGIN, HEADER_Y).lineTo(page.width - MARGIN, HEADER_Y).stroke();
  ctx.undash();
  ctx.restore();
}

function drawChapterStartGuide(page, ctx) {
  ctx.save();
  ctx.strokeColor('#16a34a').lineWidth(0.6).dash(4, { space: 3 });
  ctx.moveTo(MARGIN, CHAPTER_TARGET_Y).lineTo(page.width - MARGIN, CHAPTER_TARGET_Y).stroke();
  ctx.undash();
  ctx.restore();
}

function drawActualChapterTop(page, ctx) {
  const chapterBox = (page.boxes || []).find((box) => box.type === 'chapter-heading');
  if (!chapterBox) return;

  ctx.save();
  ctx.strokeColor('#f59e0b').lineWidth(0.8);
  ctx.moveTo(MARGIN, chapterBox.y).lineTo(page.width - MARGIN, chapterBox.y).stroke();
  ctx.font('Helvetica', 8);
  ctx.fillColor('#f59e0b');
  ctx.text(`actual chapter top (${Math.round(chapterBox.y)}pt)`, page.width - 185, chapterBox.y - 10);
  ctx.restore();
}

function drawBaselineGrid(page, ctx) {
  const left = MARGIN;
  const right = page.width - MARGIN;
  const top = MARGIN;
  const bottom = page.height - MARGIN;

  ctx.save();
  ctx.strokeColor('#94a3b8').lineWidth(0.3).dash(1, { space: 5 });
  for (let y = top; y <= bottom; y += BASELINE_STEP) {
    ctx.moveTo(left, y).lineTo(right, y).stroke();
  }
  ctx.undash();
  ctx.restore();
}

function drawLabels(page, ctx) {
  const label = `manuscript debug overlay - p${page.index + 1}`;
  ctx.save();
  ctx.font('Helvetica', 8);
  ctx.fillColor('#334155');
  ctx.text(label, MARGIN, 20);
  ctx.fillColor('#ef4444');
  ctx.text('1in margin frame', MARGIN + 4, MARGIN + 4);
  ctx.fillColor('#2563eb');
  ctx.text('header baseline', page.width - 150, HEADER_Y - 10);
  ctx.fillColor('#64748b');
  ctx.text('24pt baseline grid', page.width - 150, MARGIN + 4);
  ctx.fillColor('#16a34a');
  const hasChapter = (page.boxes || []).some((box) => box.type === 'chapter-heading');
  if (hasChapter) {
    ctx.text('chapter start target (~1/3)', page.width - 170, CHAPTER_TARGET_Y - 10);
  }
  ctx.restore();
}

export default {
  backdrop(page, ctx) {
    drawBaselineGrid(page, ctx);
  },
  overlay(page, ctx) {
    drawMarginFrame(page, ctx);
    drawHeaderGuide(page, ctx);
    const hasChapter = (page.boxes || []).some((box) => box.type === 'chapter-heading');
    if (hasChapter) {
      drawChapterStartGuide(page, ctx);
      drawActualChapterTop(page, ctx);
    }
    drawLabels(page, ctx);
  }
};
