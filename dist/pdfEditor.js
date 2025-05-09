const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentMode = 'draw';
let currentLineType = 'highlight';
let firstPoint = null;
let selectedColor = 'yellow';
let selectedTextColor = 'blue';
const historyMap = new WeakMap();
const drawHistory = {};
let pdfIdGlobal = null;
let selectedElement = null;
let isDragging = false;
let dragStart = null;

/**
 * PDF 에디터를 로드하고 초기화
 * @param {Object} options
 * @param {string} options.pdfUrl - PDF 파일의 URL
 * @param {string} [options.containerId='pdf-editor-container'] - PDF를 렌더링할 컨테이너 ID
 * @param {string} [options.menuId='pdf-editor-menu'] - 메뉴를 렌더링할 컨테이너 ID
 * @param {number} [options.scale=1.5] - PDF 스케일
 * @param {string} [options.fileIdParam='real_file'] - URL에서 추출할 파일 ID 파라미터명
 */
async function loadAndEnablePdfEditor(options = {}) {
    const {
        pdfUrl,
        containerId = 'pdf-editor-container',
        scale = 1.5,
        menuId = 'pdf-editor-menu',
        fileIdParam = 'real_file'
    } = options;

    if (!pdfUrl) {
        throw new Error('pdfUrl 옵션이 필요합니다.');
    }

    pdfIdGlobal = extractFileIdFromUrl(pdfUrl, fileIdParam);
    console.log('PDF 식별자:', pdfIdGlobal);

    createMenu(menuId);

    return new Promise(async (resolve, reject) => {
        try {
            const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
            console.log(`PDF 로드 완료: ${pdfUrl}, 총 페이지: ${pdfDoc.numPages}`);

            const container = document.getElementById(containerId);
            container.innerHTML = '';

            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });

                const pageWrapper = document.createElement('div');
                pageWrapper.style.position = 'relative';
                pageWrapper.style.marginBottom = '20px';

                const canvas = document.createElement('canvas');
                canvas.style.display = 'block';
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const overlay = document.createElement('canvas');
                overlay.classList.add('draw-layer');
                overlay.width = viewport.width;
                overlay.height = viewport.height;
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.cursor = 'crosshair';

                pageWrapper.appendChild(canvas);
                pageWrapper.appendChild(overlay);
                container.appendChild(pageWrapper);

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                historyMap.set(overlay, []);
                drawHistory[pageNum - 1] = [];
                attachEvents(overlay, pageNum - 1);
            }

            window.addEventListener('keydown', handleUndo);
            window.addEventListener('keydown', handleDelete);

            resolve();
        } catch (err) {
            console.error('PDF Editor 에러:', err);
            reject(err);
        }
    });
}

function extractFileIdFromUrl(url, paramName = 'real_file') {
    const u = new URL(url, window.location.origin);
    const param = u.searchParams.get(paramName);
    return param ? param.replace(/\.[^/.]+$/, '') : null;  // 확장자 제거
}

function createMenu(menuId) {
    const menuContainer = document.getElementById(menuId);
    if (!menuContainer) {
        console.warn(`Menu container (${menuId}) not found.`);
        return;
    }
    menuContainer.innerHTML = `
        <div class="d-flex flex-wrap align-items-center gap-2">
            <div class="btn-group" role="group">
                <button id="mode-draw" class="btn btn-success btn-sm">선 그리기</button>
                <button id="mode-text" class="btn btn-success btn-sm">글쓰기</button>
            </div>
            <select id="line-type" class="form-select form-select-sm w-auto">
                <option value="highlight" selected>형광펜</option>
                <option value="normal">일반 선</option>
            </select>
            <select id="color-picker" class="form-select form-select-sm w-auto">
                <option value="yellow" selected>노랑</option>
                <option value="blue">파랑</option>
                <option value="red">빨강</option>
                <option value="green">초록</option>
                <option value="black">검정</option>
            </select>
            <div class="btn-group ms-2" role="group">
                <button id="print-btn" class="btn btn-primary btn-sm">프린트</button>
                <button id="save-btn" class="btn btn-primary btn-sm">저장</button>
                <button id="download-btn" class="btn btn-primary btn-sm">다운로드</button>
            </div>
        </div>
    `;

    document.getElementById('mode-draw').addEventListener('click', () => {
        currentMode = 'draw';
        console.log('모드: 선 그리기');
        document.getElementById('color-picker').value = selectedColor;
    });

    document.getElementById('mode-text').addEventListener('click', () => {
        currentMode = 'text';
        console.log('모드: 글쓰기');
        document.getElementById('color-picker').value = selectedTextColor;
    });

    document.getElementById('line-type').addEventListener('change', (e) => {
        currentLineType = e.target.value;
        console.log(`선 종류 선택: ${currentLineType}`);
    });

    document.getElementById('color-picker').addEventListener('change', (e) => {
        const color = e.target.value;
        if (currentMode === 'draw') {
            selectedColor = color;
            console.log(`선 색상 선택: ${color}`);
        } else if (currentMode === 'text') {
            selectedTextColor = color;
            console.log(`글씨 색상 선택: ${color}`);
        }
    });

    document.getElementById('print-btn').addEventListener('click', () => {
        printAllPages();
    });

    document.getElementById('save-btn').addEventListener('click', () => {
        if (pdfIdGlobal) {
            saveDrawingData(pdfIdGlobal);
        } else {
            alert('PDF URL에서 식별자를 찾을 수 없습니다.');
        }
    });

    document.getElementById('download-btn').addEventListener('click', () => {
        downloadPdf();
    });
}

function attachEvents(overlay, pageIndex) {
    const ctx = overlay.getContext('2d');

    overlay.addEventListener('click', (e) => {
        if (e.button !== 0) return;

        if (isDragging) {
            isDragging = false;
            return;
        }

        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (currentMode === 'draw') {
            if (!firstPoint) {
                firstPoint = { x, y };
            } else {
                pushHistory(overlay, pageIndex);

                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineWidth = (currentLineType === 'highlight') ? 15 : 3;
                ctx.strokeStyle = selectedColor;

                if (currentLineType === 'highlight') {
                    ctx.globalAlpha = 0.3;
                    ctx.globalCompositeOperation = 'multiply';
                } else {
                    ctx.globalAlpha = 1.0;
                    ctx.globalCompositeOperation = 'source-over';
                }

                ctx.beginPath();
                ctx.moveTo(firstPoint.x, firstPoint.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.restore();

                saveAction(pageIndex, {
                    type: 'line',
                    lineType: currentLineType,
                    color: selectedColor,
                    from: firstPoint,
                    to: { x, y }
                });

                firstPoint = null;
            }
        } else if (currentMode === 'text') {
            const userText = prompt('추가할 글씨를 입력하세요:');
            if (userText) {
                pushHistory(overlay, pageIndex);
                ctx.font = '20px Arial';
                ctx.fillStyle = selectedTextColor;
                ctx.fillText(userText, x, y);

                saveAction(pageIndex, {
                    type: 'text',
                    color: selectedTextColor,
                    position: { x, y },
                    text: userText
                });
            }
        }
    });

    overlay.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        const rect = overlay.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const actions = drawHistory[pageIndex];

        let foundIndex = -1;
        actions.forEach((action, idx) => {
            if (action.type === 'line') {
                const distance = pointLineDistance(
                    { x, y },
                    action.from,
                    action.to
                );
                if (distance < 10) {
                    foundIndex = idx;
                }
            } else if (action.type === 'text') {
                const textX = action.position.x;
                const textY = action.position.y;
                ctx.font = '20px Arial';
                const metrics = ctx.measureText(action.text);
                const textWidth = metrics.width;
                const textHeight = 24;

                if (
                    x >= (textX - 5) &&
                    x <= (textX - 5 + textWidth + 10) &&
                    y >= (textY - textHeight + 5) &&
                    y <= (textY - textHeight + 5 + textHeight)
                ) {
                    foundIndex = idx;
                }
            }
        });

        if (foundIndex !== -1) {
            console.log(`선택됨: page ${pageIndex + 1}, action ${foundIndex}`);
            selectedElement = { pageIndex, actionIndex: foundIndex };
            highlightSelection(overlay, actions[foundIndex]);
        } else {
            console.log('선택 안됨');
            selectedElement = null;
            redrawOverlay(overlay, actions);
        }
    });

    overlay.addEventListener('mousedown', (e) => {
        if (selectedElement && e.button === 2) {
            e.preventDefault();
            isDragging = true;
            const rect = overlay.getBoundingClientRect();
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            document.body.style.userSelect = 'none';
        }
    });

    overlay.addEventListener('mousemove', (e) => {
        if (isDragging && selectedElement && e.buttons === 2) {
            e.preventDefault();
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;

            const { pageIndex, actionIndex } = selectedElement;
            const action = drawHistory[pageIndex][actionIndex];

            const tempAction = JSON.parse(JSON.stringify(action));
            if (action.type === 'text') {
                tempAction.position.x += dx;
                tempAction.position.y += dy;
            } else if (action.type === 'line') {
                tempAction.from.x += dx;
                tempAction.from.y += dy;
                tempAction.to.x += dx;
                tempAction.to.y += dy;
            }

            redrawOverlay(overlay, drawHistory[pageIndex]);
            highlightSelection(overlay, tempAction);
        }
    });

    overlay.addEventListener('mouseup', (e) => {
        if (isDragging && selectedElement && e.button === 2) {
            e.preventDefault();
            const rect = overlay.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;

            const { pageIndex, actionIndex } = selectedElement;
            const action = drawHistory[pageIndex][actionIndex];

            if (action.type === 'text') {
                action.position.x += dx;
                action.position.y += dy;
            } else if (action.type === 'line') {
                action.from.x += dx;
                action.from.y += dy;
                action.to.x += dx;
                action.to.y += dy;
            }

            redrawOverlay(overlay, drawHistory[pageIndex]);
            highlightSelection(overlay, action);

            isDragging = false;
            dragStart = null;
            document.body.style.userSelect = '';
        }
    });
}

function saveAction(pageIndex, action) {
    if (!drawHistory[pageIndex]) {
        drawHistory[pageIndex] = [];
    }
    drawHistory[pageIndex].push(action);
}

function pushHistory(overlay, pageIndex) {
    const ctx = overlay.getContext('2d');
    const history = historyMap.get(overlay);

    if (!history) {
        console.warn('히스토리가 초기화되지 않았습니다.');
        return;
    }

    const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
    history.push({
        imageData: imageData,
        drawSnapshot: JSON.parse(JSON.stringify(drawHistory[pageIndex]))
    });
}

function handleUndo(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        console.log('Undo 실행');
        document.querySelectorAll('.draw-layer').forEach(overlay => {
            const history = historyMap.get(overlay);
            if (history && history.length > 0) {
                const { imageData, drawSnapshot } = history.pop();
                const ctx = overlay.getContext('2d');
                ctx.clearRect(0, 0, overlay.width, overlay.height);
                ctx.putImageData(imageData, 0, 0);

                const pageIndex = Array.from(document.querySelectorAll('#pdf-editor-container > div')).indexOf(overlay.parentElement);
                if (pageIndex !== -1) {
                    drawHistory[pageIndex] = drawSnapshot;
                }
            }
        });
    }
}

function handleDelete(e) {
    if (e.key === 'Delete' && selectedElement) {
        const { pageIndex, actionIndex } = selectedElement;
        console.log(`삭제: page ${pageIndex + 1}, action ${actionIndex}`);

        drawHistory[pageIndex].splice(actionIndex, 1);

        const wrapper = document.querySelectorAll('#pdf-editor-container > div')[pageIndex];
        const overlay = wrapper.querySelector('.draw-layer');
        redrawOverlay(overlay, drawHistory[pageIndex]);

        selectedElement = null;
    }
}

function printAllPages() {
    const pageWrappers = document.querySelectorAll('#pdf-editor-container > div');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>PDF Print</title>
            <style>
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0;
                    }
                    img {
                        page-break-after: always;
                        width: 100%;
                        display: block;
                        margin: 0 auto;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
    `);

    let loadedCount = 0;

    pageWrappers.forEach((wrapper, index) => {
        const pdfCanvas = wrapper.querySelector('canvas:nth-child(1)');
        const overlayCanvas = wrapper.querySelector('canvas:nth-child(2)');

        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = pdfCanvas.width;
        combinedCanvas.height = pdfCanvas.height;
        const ctx = combinedCanvas.getContext('2d');

        ctx.drawImage(pdfCanvas, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0);

        const imgData = combinedCanvas.toDataURL('image/png');
        const img = printWindow.document.createElement('img');
        img.src = imgData;

        img.onload = () => {
            loadedCount++;
            if (loadedCount === pageWrappers.length) {
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
            }
        };

        img.style.width = '100%';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        if (index !== pageWrappers.length - 1) {
            img.style.pageBreakAfter = 'always';
        }

        printWindow.document.body.appendChild(img);
    });
}

function saveDrawingData(pdfId) {
    const saveData = {
        pdfId: pdfId,
        pages: []
    };

    Object.keys(drawHistory).forEach(pageIdx => {
        saveData.pages.push({
            page: parseInt(pageIdx) + 1,
            actions: drawHistory[pageIdx]
        });
    });

    fetch('/php/save_draw_data.php', {
        method: 'POST',
        body: JSON.stringify(saveData),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(res => res.json())
      .then(data => {
          if (data.success) {
              alert('저장 완료!');
          } else {
              alert('저장 실패: ' + data.message);
          }
      });
}

function loadFromServer(pdfId) {
    fetch(`/php/get_draw_data.php?pdf_id=${encodeURIComponent(pdfId)}`)
        .then(res => res.json())
        .then(data => {
            console.log('불러온 데이터:', data);
            if (data.pages) {
                loadDrawingData(data);
            }
        });
}

function loadDrawingData(data) {
    data.pages.forEach(pageData => {
        const wrapper = document.querySelectorAll('#pdf-editor-container > div')[pageData.page - 1];
        const overlay = wrapper.querySelector('.draw-layer');

        drawHistory[pageData.page - 1] = [...pageData.actions];

        const newOverlay = overlay.cloneNode(true);
        overlay.parentNode.replaceChild(newOverlay, overlay);
        historyMap.set(newOverlay, []);
        attachEvents(newOverlay, pageData.page - 1);

        redrawOverlay(newOverlay, pageData.actions);
    });
}

function redrawOverlay(overlay, actions) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    actions.forEach(action => {
        if (action.type === 'line') {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineWidth = (action.lineType === 'highlight') ? 15 : 3;
            ctx.strokeStyle = action.color;

            if (action.lineType === 'highlight') {
                ctx.globalAlpha = 0.3;
                ctx.globalCompositeOperation = 'multiply';
            } else {
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
            }

            ctx.beginPath();
            ctx.moveTo(action.from.x, action.from.y);
            ctx.lineTo(action.to.x, action.to.y);
            ctx.stroke();
            ctx.restore();
        } else if (action.type === 'text') {
            ctx.font = '20px Arial';
            ctx.fillStyle = action.color;
            ctx.fillText(action.text, action.position.x, action.position.y);
        }
    });
}

function highlightSelection(overlay, action) {
    redrawOverlay(overlay, drawHistory[Array.from(document.querySelectorAll('#pdf-editor-container > div')).indexOf(overlay.parentElement)]);

    const ctx = overlay.getContext('2d');
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);

    if (action.type === 'line') {
        const minX = Math.min(action.from.x, action.to.x);
        const minY = Math.min(action.from.y, action.to.y);
        const width = Math.abs(action.to.x - action.from.x);
        const height = Math.abs(action.to.y - action.from.y);
        ctx.strokeRect(minX - 5, minY - 5, width + 10, height + 10);
    } else if (action.type === 'text') {
        ctx.font = '20px Arial';
        const metrics = ctx.measureText(action.text);
        const textWidth = metrics.width;
        const textHeight = 24;
        ctx.strokeRect(action.position.x - 5, action.position.y - textHeight + 5, textWidth + 10, textHeight);
    }

    ctx.restore();
}

function pointLineDistance(point, lineStart, lineEnd) {
    const { x, y } = point;
    const { x: x1, y: y1 } = lineStart;
    const { x: x2, y: y2 } = lineEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

async function downloadPdf() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: 'a4'
    });

    const pageWrappers = document.querySelectorAll('#pdf-editor-container > div');

    for (let i = 0; i < pageWrappers.length; i++) {
        const wrapper = pageWrappers[i];
        const pdfCanvas = wrapper.querySelector('canvas:nth-child(1)');
        const overlayCanvas = wrapper.querySelector('canvas:nth-child(2)');

        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = pdfCanvas.width;
        combinedCanvas.height = pdfCanvas.height;
        const ctx = combinedCanvas.getContext('2d');

        ctx.drawImage(pdfCanvas, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0);

        const imgData = combinedCanvas.toDataURL('image/png');

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / combinedCanvas.width, pageHeight / combinedCanvas.height);
        const imgWidth = combinedCanvas.width * ratio;
        const imgHeight = combinedCanvas.height * ratio;

        if (i > 0) {
            pdf.addPage();
        }
        pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, (pageHeight - imgHeight) / 2, imgWidth, imgHeight);
    }

    const pdfFileName = pdfIdGlobal ? `pdf_${pdfIdGlobal}.pdf` : 'download.pdf';
    pdf.save(pdfFileName);
}

// ✅ 전역 노출
window.pdfEditor = {
    loadAndEnablePdfEditor,
    loadFromServer
};