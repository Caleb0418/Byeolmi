const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak, TableOfContents } = require('docx');
const C = require('./_common');

const step = (t) => C.numItem(t, { ref: 'steps' });
const children = [];

// ───────── 표지 ─────────
children.push(
  new Paragraph({ spacing: { before: 2600 }, children: [] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: 'BONGBONG · 도매 발주·정산 시스템', size: 22, bold: true, color: C.GREEN })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: '별미집 사용 매뉴얼', size: 52, bold: true, color: C.NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: '화면별 따라 하기 안내서', size: 36, bold: true, color: C.NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new TextRun({ text: '대시보드 · 발주서 · 정산 명세서 · 자주 묻는 질문', size: 22, color: C.GRAY })] }),
  new Paragraph({ spacing: { before: 1400 }, children: [] }),
  C.table([3120, 6240], ['항목', '내용'], [
    ['작성일', '2026년 6월 4일'],
    ['버전', 'v0.9 (체험용)'],
    ['대상 독자', '별미집 사장님 및 사용자'],
    ['중요 안내', { t: '화면의 상호·계좌·사업자정보는 모두 샘플(테스트)입니다.', color: C.GREEN, bold: true }],
  ]),
  new Paragraph({ children: [new PageBreak()] }),
);

// ───────── 목차 ─────────
children.push(
  C.h1('목차'),
  C.p('아래 제목을 누르면 해당 위치로 이동합니다. (Word에서 열면 쪽 번호가 자동으로 채워집니다.)', { size: 18, color: C.GRAY }),
  new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ───────── 시작 전 준비 ─────────
children.push(
  C.h1('시작 전에'),
  C.h2('준비물'),
  C.bullet('인터넷이 되는 PC(권장) 또는 태블릿·휴대폰'),
  C.bullet('아래 “접속 주소”의 링크'),
  C.bullet('실제로 사용하실 때: 사장님 카카오 계정'),
  C.h2('접속 주소'),
  C.p('아래 주소로 접속하시면 됩니다.'),
  C.table([3200, 6160], ['화면', '주소'], [
    [{ t: '사장님 관리 화면', bold: true }, 'https://byeolmi-six.vercel.app/'],
    [{ t: '거래처 발주서', bold: true }, 'https://byeolmi-six.vercel.app/client.html'],
    [{ t: '정산 명세서', bold: true }, '거래처가 받은 알림톡 링크로 자동 열립니다(직접 입력하실 필요 없음).'],
  ]),
  C.callout([[new TextRun({ text: '안내  ', bold: true, color: C.NAVY }), new TextRun({ text: '맨 위 ‘사장님 관리 화면’ 주소는 거래처에 보내지 마세요. 거래처에는 ‘거래처 발주서’ 주소만 안내하시면 됩니다.', size: 21 })]], C.LIGHT, C.NAVY),
  C.h2('권장 환경'),
  C.bullet('사장님 관리 화면: PC 크롬 브라우저 권장'),
  C.bullet('구매자 발주서·정산 명세서: 휴대폰에 최적화(모든 기기 사용 가능)'),
  C.callout([
    [new TextRun({ text: '안내  ', bold: true, color: C.NAVY }), new TextRun({ text: '지금은 미리 체험해 보실 수 있도록 로그인 없이 모든 화면을 열 수 있습니다. 화면의 상호·계좌·사업자정보는 실제 값이 아닌 샘플이며, 실제로 사용하시기 전에 실제 값으로 바꿔야 합니다.', size: 21 })],
  ], C.SAMPLE, C.GREEN),
);

// ───────── A. 사장님 대시보드 ─────────
children.push(new Paragraph({ children: [new PageBreak()] }), C.h1('A. 사장님 관리자 대시보드'));

// A-0
children.push(
  C.h2('A-0. 접속 및 로그인'),
  step('안내받은 주소로 접속하면 사장님 대시보드가 열립니다.'),
  step('지금은 체험을 위해 로그인 없이 바로 열립니다.'),
  step('실제로 사용하실 때는 사장님 계정으로만 열리도록 설정하여, 다른 분은 이 화면을 열 수 없게 합니다.'),
);

// A-1
children.push(
  C.h2('A-1. 화면 전체 구조'),
  C.p('왼쪽에 메뉴, 위쪽에 실행 버튼이 있습니다.'),
  C.bullet([new TextRun({ text: '왼쪽 메뉴 4개: ', bold: true }), new TextRun('실시간 대시보드 · 분석 및 통계 · 품목 및 단가 설정 · 시스템 설정')]),
  C.bullet([new TextRun({ text: '맨 아래 ‘구매자 주문서(체험)’ 링크: ', bold: true }), new TextRun('거래처가 보는 발주서를 사장님이 직접 체험해 볼 수 있습니다.')]),
  C.bullet([new TextRun({ text: '오른쪽 위 버튼 2개: ', bold: true }), new TextRun('지금까지 들어온 발주 승인하기 · 정산 알림톡 일괄 발송')]),
  ...C.figure('D-02_sidebar.png', 150, '[A-1] 왼쪽 메뉴 영역'),
);

// A-2
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('A-2. 실시간 대시보드'),
  C.p('오늘의 주문 상황을 한눈에 봅니다. 화면은 약 3초마다 자동으로 갱신됩니다.'),
  C.bullet([new TextRun({ text: '위쪽 요약 카드 3개: ', bold: true }), new TextRun('오늘 총 주문량 · 현재 기준 예상 매출 · 승인 대기 주문(카드를 누르면 대기 목록을 자세히 볼 수 있습니다).')]),
  C.bullet([new TextRun({ text: '실시간 카카오 취합 내역: ', bold: true }), new TextRun('거래처가 넣은 발주가 표로 모입니다.')]),
  C.bullet([new TextRun({ text: '품목별 당일 집계: ', bold: true }), new TextRun('오른쪽에서 품목별 누적 수량을 확인합니다.')]),
  ...C.figure('D-01_dashboard.png', 600, '[A-2] 실시간 대시보드 전체 모습'),
  C.h3('일괄 수정 — 들어온 발주 고치기/지우기'),
  step('취합 내역 표 오른쪽 위의 [일괄 수정] 버튼을 누릅니다.'),
  step('각 줄에서 수량을 직접 고치거나, 오른쪽 X로 삭제합니다.'),
  step('다 고치면 [완료]를 눌러 저장합니다.'),
  ...C.figure('D-03_bulk_edit.png', 600, '[A-2] 일괄 수정 모드 — 줄별 수정·삭제 후 완료로 저장'),
  C.h3('전화 주문 수기 추가'),
  step('취합 내역 표의 [전화 주문 수기 추가] 버튼을 누릅니다.'),
  step('거래처 이름(최근 거래처가 자동 추천됩니다)·품목·수량을 입력합니다.'),
  step('[주문 추가]를 누르면 목록에 바로 반영됩니다.'),
  ...C.figure('D-04_manual_order.png', 470, '[A-2] 전화/수기 주문 추가 창'),
  C.h3('휴대폰·태블릿에서도'),
  C.p('화면 크기에 맞춰 자동으로 정렬되므로, 작은 화면에서는 보기 좋게 카드 모양으로 나옵니다.', { after: 80 }),
  ...C.figure('D-10_dashboard_mobile.png', 250, '[A-2] 휴대폰에서 본 대시보드'),
);

// A-3
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('A-3. 발주 승인 → 정산 알림톡 일괄 발송'),
  step('오른쪽 위 [지금까지 들어온 발주 승인하기]를 눌러 대기 주문을 승인합니다.'),
  step('[정산 알림톡 일괄 발송]을 누르면, 거래처별 정산 명세서 미리보기가 카카오톡 모양으로 표시됩니다.'),
  step('내용을 확인한 뒤 [알림톡 일괄 발송 승인]을 누릅니다.'),
  C.callout([[new TextRun({ text: '참고  ', bold: true, color: C.NAVY }), new TextRun({ text: '실제 알림톡은 카카오 채널 준비가 끝난 뒤부터 보내집니다. 지금은 보내기 전 미리보기까지 확인하실 수 있습니다.', size: 21 })]], C.LIGHT, C.NAVY),
  ...C.figure('D-05_alimtalk_preview.png', 470, '[A-3] 정산 알림톡 미리보기 — 거래처별 청구액과 입금 계좌가 자동으로 채워집니다.'),
);

// A-4
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('A-4. 분석 및 통계'),
  C.bullet([new TextRun({ text: '위쪽 요약 카드 4개: ', bold: true }), new TextRun('이번 달 총 매출액 · 누적 판매량 · 주문 1건당 평균 금액 · 거래한 거래처 수. 각 카드를 누르면 자세한 내용이 열립니다.')]),
  C.bullet([new TextRun({ text: '매출·거래량 추이: ', bold: true }), new TextRun('월간·주간·일간 버튼으로 기간을 바꿔 봅니다. 품목별로도 볼 수 있습니다.')]),
  C.bullet([new TextRun({ text: '품목별 판매 비중: ', bold: true }), new TextRun('도넛 그래프로 어떤 품목이 많이 팔리는지 봅니다.')]),
  C.bullet([new TextRun({ text: '거래처별 누적·수금/미수금: ', bold: true }), new TextRun('표에서 거래처명을 누르면 정산 관리 창이 열립니다.')]),
  ...C.figure('D-06_analytics_charts.png', 560, '[A-4] 분석 및 통계 — 매출 추이·품목 비중·거래처별 누적'),
  C.h3('수금/미수금 관리'),
  step('거래처별 누적 표에서 거래처명을 누릅니다.'),
  step('발주 건별로 정산 상태(미수/수금)를 바꾸거나, [모든 미수 주문 일괄 수금완료]로 한 번에 처리합니다.'),
  step('알림톡이 보내지지 않은 건이 있으면, 이 창에서 다시 보낼 수 있습니다.'),
  ...C.figure('D-07_settlement_modal.png', 470, '[A-4] 거래처별 발주·정산 관리 창 — 미수금 확인 및 수금 처리'),
);

// A-5
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('A-5. 품목 및 단가 설정'),
  step('왼쪽 메뉴 [품목 및 단가 설정]을 엽니다.'),
  step('[+ 품목 추가]로 새 품목을 등록하거나, 왼쪽 목록에서 품목을 눌러 수정·삭제합니다.'),
  step('품목명·카테고리·기본 단가·규격 단위·공급 상태를 입력합니다.'),
  step('수량별 차등 도매 단가에서 [단가 구간 추가]로 “○개 이상이면 ○원”을 설정합니다. (예: 10개 이상 18,000원, 30개 이상 15,000원)'),
  step('[저장 완료]를 누르면 발주서·정산에 즉시 반영됩니다.'),
  ...C.figure('D-08_product_pricing.png', 580, '[A-5] 품목 편집과 수량별 차등 단가 설정(혜택 미리보기 포함)'),
);

// A-6
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('A-6. 시스템 설정'),
  C.bullet([new TextRun({ text: '사장님 계정 등록: ', bold: true }), new TextRun('대시보드 접근 권한을 가질 카카오 이메일을 등록·삭제합니다.')]),
  C.bullet([new TextRun({ text: '결제 계좌 및 상호 설정: ', bold: true }), new TextRun('상호·은행·예금주·계좌번호를 입력합니다. 여기에 입력한 정보가 정산 명세서·알림톡의 입금 계좌로 표시됩니다.')]),
  C.callout([[new TextRun({ text: '중요  ', bold: true, color: 'b91c1c' }), new TextRun({ text: '현재는 샘플 값이 들어가 있습니다. 정식 사용 전 반드시 실제 계좌·상호로 바꿔 주세요.', size: 21 })]], C.SAMPLE, 'b91c1c'),
  ...C.figure('D-09_system_settings.png', 470, '[A-6] 시스템 환경 설정 — 계정 권한·계좌·상호 관리'),
);

// ───────── B. 구매자 발주서 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('B. 구매자 발주서 (거래처용)'),
  C.p('거래처가 휴대폰으로 발주를 넣는 화면입니다. 3단계로 진행됩니다.'),
  C.h2('1단계 — 품목 선택'),
  step('카테고리(전체보기·신선식품·간편조리·간식·생활용품)로 품목을 거릅니다.'),
  step('품목마다 − / + 또는 숫자 입력으로 수량을 담습니다.'),
  step('하나라도 담으면 화면 아래에 “총 ○개 품목 다음 단계로” 버튼이 나타납니다.'),
);
children.push(...C.figure('C-01_client_step1.png', 250, '[B-1] 품목 선택 화면'));
children.push(...C.figure('C-02_client_selected.png', 250, '[B-1] 수량을 담으면 아래쪽에 다음 단계 버튼이 나타납니다'));
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h2('2단계 — 발주자 정보 입력'),
  step('대표자명/업체명과 휴대폰 번호(알림톡 전송용)를 입력합니다.'),
  step('[발주 정보 확인]을 누릅니다. (번호는 자동으로 하이픈이 들어갑니다.)'),
);
children.push(...C.figure('C-03_client_step2.png', 250, '[B-2] 발주자 정보 입력'));
children.push(
  C.h2('3단계 — 최종 확인 및 전송'),
  step('품목·수량·발주자 정보를 다시 확인합니다.'),
  step('[최종 발주서 전송하기]를 누르면 발주가 접수되고, 완료 안내가 아래에서 올라옵니다.'),
);
children.push(...C.figure('C-04_client_step3.png', 250, '[B-3] 최종 확인 화면'));
children.push(...C.figure('C-05_client_success.png', 250, '[B-3] 발주 완료 안내'));
children.push(
  C.callout([[new TextRun({ text: '참고  ', bold: true, color: C.NAVY }), new TextRun({ text: '발주가 접수되면 거래처에게 ‘접수 확인’ 알림톡도 함께 보내집니다(알림톡 발송 준비가 끝나면 자동으로 동작합니다). 화면 맨 아래의 상호·사업자 정보는 현재 샘플 값입니다.', size: 21 })]], C.LIGHT, C.NAVY),
);

// ───────── C. 정산 명세서 ─────────
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  C.h1('C. 정산 명세서 (거래처가 받는 화면)'),
  step('거래처는 알림톡으로 받은 [상세 정산 명세서 보기] 링크를 누릅니다.'),
  step('품목·수량·도매 단가·합계와 정산 상태(입금 대기/완료)를 확인합니다.'),
  step('[계좌 복사] 버튼으로 입금 계좌를 복사해 간편하게 송금합니다.'),
);
children.push(...C.figure('I-01_invoice_full.png', 250, '[C] 정산 명세서 전체 — 입금 상태가 자동으로 표시됩니다.'));
children.push(...C.figure('I-02_invoice_account.png', 360, '[C] 입금 계좌 영역과 계좌 복사 버튼'));

// ───────── D. FAQ ─────────
const faq = [
  ['거래처가 발주를 넣었는데 제 화면에 안 보여요.', '화면은 약 3초마다 자동으로 갱신됩니다. 바로 확인하시려면 우측 상단 새로고침 버튼을 눌러 주세요. 그래도 안 보이면 인터넷 연결과 로그인 상태를 확인해 주세요.'],
  ['카카오 알림톡이 보내지지 않아요.', '실제 알림톡은 카카오 채널 준비가 끝난 뒤부터 보내집니다. 지금은 체험 단계라 보내지지 않을 수 있습니다. 준비가 끝나면 정상적으로 보내지며, 보내지 못한 건은 거래처 정산 관리 창에서 다시 보낼 수 있습니다.'],
  ['품목이나 단가를 바꾸고 싶어요.', '왼쪽 메뉴 [품목 및 단가 설정]에서 품목 추가·수정·삭제와 수량별 차등(구간) 단가를 바꿀 수 있습니다.'],
  ['전화로 받은 주문은 어떻게 넣나요?', '[실시간 대시보드]의 [전화 주문 수기 추가] 버튼으로 직접 입력하시면 됩니다.'],
  ['들어온 발주 내용을 고치거나 지우려면요?', '취합 내역 표의 [일괄 수정] 버튼을 누르면 줄별로 수정할 수 있고, 각 줄의 X로 삭제됩니다. 다 고치면 [완료]를 눌러 저장합니다.'],
  ['입금 계좌나 상호를 바꾸려면요?', '왼쪽 [시스템 설정]에서 변경합니다. 현재는 샘플 값이 들어가 있어, 정식 사용 전 실제 계좌·상호로 바꿔 주셔야 합니다.'],
  ['미수금(아직 못 받은 돈)은 어떻게 관리하나요?', '[분석 및 통계]의 거래처별 누적 현황에서 거래처명을 누르면, 수금/미수금 상태를 바꾸고 금액을 관리할 수 있습니다.'],
  ['거래처는 정산 명세서를 어떻게 보나요?', '알림톡으로 전송된 링크를 누르면 휴대폰에서 명세서와 입금 계좌를 확인하고, 계좌 복사 버튼으로 간편하게 송금할 수 있습니다.'],
  ['휴대폰이나 태블릿에서도 쓸 수 있나요?', '네. 화면이 기기 크기에 맞춰 자동으로 정렬되어 PC·태블릿·휴대폰 모두에서 편하게 사용할 수 있습니다.'],
  ['다른 사람도 제 관리 화면을 볼 수 있나요?', '지금은 체험을 위해 화면이 열려 있습니다. 실제로 사용하실 때는 사장님 계정으로만 열리도록 설정하여, 다른 분은 관리 화면을 볼 수 없습니다.'],
];
children.push(new Paragraph({ children: [new PageBreak()] }), C.h1('D. 자주 묻는 질문 (FAQ)'));
faq.forEach(([q, a], i) => {
  children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [
    new TextRun({ text: `Q${i + 1}. `, bold: true, color: C.GREEN, size: 23 }),
    new TextRun({ text: q, bold: true, color: C.NAVY, size: 23 }),
  ] }));
  children.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 360 }, children: [
    new TextRun({ text: 'A. ', bold: true, size: 22 }),
    new TextRun({ text: a, size: 22 }),
  ] }));
});

const doc = new Document({
  creator: '별미집',
  title: '별미집 사용 매뉴얼',
  styles: C.baseStyles(),
  numbering: C.numberingConfig(),
  sections: [{
    properties: C.pageProps(),
    headers: { default: C.makeHeader('별미집 사용 매뉴얼') },
    footers: { default: C.makeFooter() },
    children,
  }],
});

const OUT = path.join(__dirname, '별미집_사용_매뉴얼.docx');
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('WROTE', OUT, buf.length, 'bytes'); });
