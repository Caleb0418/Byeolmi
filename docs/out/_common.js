// 별미집 문서 공통 유틸 (docx-js)
const fs = require('fs');
const path = require('path');
const {
  Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, TabStopType, TabStopPosition,
} = require('docx');

const SHOTS = path.join(__dirname, 'screenshots');

// 브랜드 색
const NAVY = '002045';
const GREEN = '0a6c44';
const INK = '1f2937';
const GRAY = '6b7280';
const LIGHT = 'eef2f7';
const SAMPLE = 'fff4e5';

const FONT = '맑은 고딕'; // Malgun Gothic — 한글/영문 모두 렌더

// US Letter content width (1" margins)
const CONTENT = 9360;

// PNG 픽셀 크기 읽기
function pngSize(file) {
  const b = fs.readFileSync(path.join(SHOTS, file));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// 너비(px) 지정 시 비율 유지 이미지
function img(file, widthPx, opts = {}) {
  const { w, h } = pngSize(file);
  const width = widthPx;
  const height = Math.round(widthPx * h / w);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new ImageRun({
      type: 'png',
      data: fs.readFileSync(path.join(SHOTS, file)),
      transformation: { width, height },
      altText: { title: opts.title || file, description: opts.desc || file, name: file },
    })],
  });
}

// 캡션
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, italics: true, size: 18, color: GRAY })],
  });
}

// 이미지 + 캡션 묶음
function figure(file, widthPx, cap, opts = {}) {
  return [img(file, widthPx, { title: cap, desc: cap, ...opts }), caption(cap)];
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after != null ? opts.after : 120, before: opts.before || 0 },
    alignment: opts.align,
    children: [new TextRun({ text, size: opts.size || 22, bold: opts.bold, color: opts.color, italics: opts.italics })],
  });
}

function runs(children, opts = {}) {
  return new Paragraph({ spacing: { after: opts.after != null ? opts.after : 120 }, children });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: opts.ref || 'bullets', level: opts.level || 0 },
    spacing: { after: 60 },
    children: Array.isArray(text) ? text : [new TextRun({ text, size: 22 })],
  });
}

function numItem(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: opts.ref || 'numbers', level: opts.level || 0 },
    spacing: { after: 80 },
    children: Array.isArray(text) ? text : [new TextRun({ text, size: 22 })],
  });
}

function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] }); }

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'd0d7de' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function tcell(content, { width, fill, bold, color, align, size } = {}) {
  const kids = (Array.isArray(content) ? content : [content]).map(t =>
    typeof t === 'string'
      ? new Paragraph({ alignment: align, children: [new TextRun({ text: t, bold, color, size: size || 20 })] })
      : t
  );
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: kids,
  });
}

// 간단 표: header 배열 + rows(2D)
function table(colWidths, header, rows, headFill = NAVY) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const headRow = new TableRow({
    tableHeader: true,
    children: header.map((t, i) => tcell(t, { width: colWidths[i], fill: headFill, bold: true, color: 'FFFFFF' })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => {
      // 셀 값이 {t,opts} 형태 허용
      if (c && typeof c === 'object' && !Array.isArray(c) && 't' in c) {
        return tcell(c.t, { width: colWidths[i], fill: c.fill || (ri % 2 ? 'f6f8fa' : undefined), bold: c.bold, color: c.color, align: c.align });
      }
      return tcell(c, { width: colWidths[i], fill: ri % 2 ? 'f6f8fa' : undefined });
    }),
  }));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: colWidths, rows: [headRow, ...bodyRows] });
}

// 콜아웃 박스 (단색 배경 1셀 표)
function callout(lines, fill = LIGHT, accent = NAVY) {
  const kids = lines.map((ln, i) => new Paragraph({
    spacing: { after: i === lines.length - 1 ? 0 : 80 },
    children: Array.isArray(ln) ? ln : [new TextRun({ text: ln, size: 21, color: INK })],
  }));
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [CONTENT],
    rows: [new TableRow({ children: [new TableCell({
      borders: { left: { style: BorderStyle.SINGLE, size: 24, color: accent }, top: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'e5e7eb' } },
      width: { size: CONTENT, type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 140, bottom: 140, left: 200, right: 160 },
      children: kids,
    })] })],
  });
}

function spacer(after = 160) { return new Paragraph({ spacing: { after }, children: [new TextRun('')] }); }

// 공통 스타일/넘버링
function baseStyles() {
  return {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal',
        run: { size: 56, bold: true, font: FONT, color: NAVY },
        paragraph: { spacing: { before: 240, after: 120 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: FONT, color: NAVY },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GREEN, space: 6 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, font: FONT, color: NAVY },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: GREEN },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  };
}

function numberingConfig() {
  return {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1040, hanging: 280 } } } },
      ] },
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 300 } } } },
      ] },
      { reference: 'steps', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 360 } } } },
      ] },
      { reference: 'checks', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '☑', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 300 } } } },
      ] },
    ],
  };
}

function pageProps() {
  return {
    page: {
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    },
  };
}

function makeHeader(label) {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'd0d7de', space: 4 } },
    children: [new TextRun({ text: label, size: 16, color: GRAY })],
  })] });
}

function makeFooter() {
  return new Footer({ children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: '별미집  ·  ', size: 16, color: GRAY }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY }),
      new TextRun({ text: ' / ', size: 16, color: GRAY }),
      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY }),
    ],
  })] });
}

module.exports = {
  NAVY, GREEN, INK, GRAY, LIGHT, SAMPLE, FONT, CONTENT,
  img, caption, figure, p, runs, bullet, numItem, h1, h2, h3,
  table, callout, spacer, tcell, baseStyles, numberingConfig, pageProps, makeHeader, makeFooter,
  TextRun,
};
