// ==UserScript==
// @name         Auto Tiem Tra Nho - Tampermonkey Final
// @namespace    http://tampermonkey.net/
// @version      32.0
// @description  Tự quy hoạch kho theo nhu cầu khách, cắt giảm khi vượt ví, chặn lỗi 999999k
// @author       Kurok00
// @license      MIT
// @match        https://trongnhi.trongnhi110266.workers.dev/*
// @grant        none
// @run-at       document-idle
// @homepageURL  https://github.com/Kurok00/BobaAuto
// @supportURL   https://github.com/Kurok00/BobaAuto/issues
// @updateURL    https://raw.githubusercontent.com/Kurok00/BobaAuto/main/boba-auto.user.js
// @downloadURL  https://raw.githubusercontent.com/Kurok00/BobaAuto/main/boba-auto.user.js
// ==/UserScript==

(function() {
    'use strict';

    var CFG = {
        fallbackBudget: 50,      // ngân sách (k) khi không đọc được #hMoney
        clickDelay: 40,          // ms giữa 2 lần bấm
        tabDelay: 320,           // ms đợi carousel chuyển xong
        maxReduceRounds: 60,     // trần vòng cắt giảm cho 1 lượt
        loopMs: 100,             // chu kỳ quét auto phục vụ
        pressRepeatMs: 500,      // ms giữa 2 lần bơm lại nút trà

        cupsPerCustomer: 1,      // số ly mỗi khách
        toppingPerCustomer: 0.5, // trung bình phần topping mỗi khách
        restockBuffer: 5,        // tồn kho dự phòng sau khi đã phủ nhu cầu
        maxAddClicksPerRow: 10   // trần số lần bấm +5 cho 1 món
    };

    function initMod() {
        if (document.getElementById('mod-menu')) return;

        var iconEl = document.createElement('div');
        iconEl.id = 'mod-icon';
        iconEl.innerHTML = '🧋';
        iconEl.title = 'Bấm để mở menu / Kéo thả di chuyển';
        iconEl.style.cssText = 'position:fixed; top:20px; right:20px; width:46px; height:46px; border-radius:50%; background:#e74c3c; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 12px rgba(0,0,0,0.4); cursor:move; z-index:999999; user-select:none; touch-action:none; border:2px solid #ffffff;';
        document.body.appendChild(iconEl);

        var menuEl = document.createElement('div');
        menuEl.id = 'mod-menu';
        menuEl.style.cssText = 'position:fixed; top:75px; right:20px; width:250px; background:rgba(44, 62, 80, 0.95); color:#ecf0f1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.4); font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index:999999; overflow:hidden; border:1px solid #34495e; display:none; flex-direction:column;';

        var headerEl = document.createElement('div');
        headerEl.style.cssText = 'background:#e74c3c; padding:8px 12px; font-weight:bold; font-size:13px; display:flex; justify-content:space-between; align-items:center;';
        headerEl.innerHTML = '<span>🧋 Auto Tiệm Trà v32.0</span><button id="mod-close-btn" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; font-size:14px;">✕</button>';
        menuEl.appendChild(headerEl);

        var bodyEl = document.createElement('div');
        bodyEl.style.cssText = 'padding:10px; display:flex; flex-direction:column; gap:8px;';
        bodyEl.innerHTML = '<button id="btn-prep" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; text-align:center;">⚡ Auto Nhập Hàng Thông Minh</button>' +
            '<button id="btn-diag" style="background:#2980b9; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; text-align:center;">🔍 Chẩn Đoán DOM</button>' +
            '<hr style="border:0; border-top:1px solid #34495e; margin:4px 0;">' +
            '<div style="display:flex; align-items:center; gap:8px; font-size:12px;"><label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" id="chk-autocup" checked><b>Auto Ly (Anti-Trap Exact)</b></label></div>' +
            '<div style="display:flex; align-items:center; gap:8px; font-size:12px;"><label style="display:flex; align-items:center; gap:8px; cursor:pointer;"><input type="checkbox" id="chk-autofill" checked><b>Bơm Bù Nước (&lt; 80% ➔ 80%)</b></label></div>';
        menuEl.appendChild(bodyEl);
        document.body.appendChild(menuEl);

        var isDragging = false, startX, startY, initialLeft, initialTop, hasMoved = false;

        function onPointerDown(e) {
            isDragging = true; hasMoved = false;
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX; startY = clientY;
            var rect = iconEl.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            iconEl.style.right = 'auto';
            iconEl.style.left = initialLeft + 'px';
            iconEl.style.top = initialTop + 'px';
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            var clientX = e.touches ? e.touches[0].clientX : e.clientX;
            var clientY = e.touches ? e.touches[0].clientY : e.clientY;
            var dx = clientX - startX, dy = clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            var newLeft = Math.max(5, Math.min(window.innerWidth - 50, initialLeft + dx));
            var newTop = Math.max(5, Math.min(window.innerHeight - 50, initialTop + dy));
            iconEl.style.left = newLeft + 'px';
            iconEl.style.top = newTop + 'px';
            if (menuEl.style.display === 'flex') updateMenuPos(newLeft, newTop);
        }

        function onPointerUp() { isDragging = false; }

        function updateMenuPos(iLeft, iTop) {
            var mLeft = Math.max(10, Math.min(window.innerWidth - 255, iLeft - 185));
            var mTop = iTop + 52 > window.innerHeight - 170 ? iTop - 160 : iTop + 52;
            menuEl.style.left = mLeft + 'px';
            menuEl.style.top = mTop + 'px';
            menuEl.style.right = 'auto';
        }

        iconEl.addEventListener('mousedown', onPointerDown);
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('mouseup', onPointerUp);
        iconEl.addEventListener('touchstart', onPointerDown, {passive: true});
        document.addEventListener('touchmove', onPointerMove, {passive: true});
        document.addEventListener('touchend', onPointerUp);

        iconEl.addEventListener('click', function() {
            if (!hasMoved) {
                var isHidden = menuEl.style.display === 'none' || menuEl.style.display === '';
                menuEl.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) updateMenuPos(iconEl.getBoundingClientRect().left, iconEl.getBoundingClientRect().top);
            }
        });
        document.getElementById('mod-close-btn').addEventListener('click', function() { menuEl.style.display = 'none'; });

        // ---------- helpers sự kiện giả ----------
        function fire(el, types) {
            if (!el || el.isConnected === false) return;
            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                try {
                    var ev = type.indexOf('touch') === 0 ? new Event(type, { bubbles: true, cancelable: true })
                                                      : new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                    el.dispatchEvent(ev);
                } catch(e) {}
            }
        }

        function triggerFullClick(el) {
            fire(el, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']);
        }

        function startPress(el) { fire(el, ['pointerdown', 'mousedown', 'touchstart']); }
        function stopPress(el) { fire(el, ['pointerup', 'mouseup', 'touchend', 'click']); }

        function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

        // ==========================================================
        // 💰 ĐỌC TIỀN — chuẩn hoá về "k" (nghìn)
        // ==========================================================
        function toK(str) {
            if (str === null || str === undefined) return null;
            var s = String(str).replace(/[\s\u00a0]/g, '').toLowerCase();
            if (!s) return null;
            var m = s.match(/\d+(?:[.,]\d+)?/);
            if (!m) return null;
            var val = parseFloat(m[0].replace(',', '.'));
            if (!isFinite(val)) return null;
            var after = s.slice(m.index + m[0].length);
            if (/^(tr|triệu)/.test(after) || /^t$/.test(after)) return val * 1000;
            if (/^(k|nghìn|ng)/.test(after)) return val;
            if (/^(đ|vnd|₫)/.test(after)) return val / 1000;
            if (/tr/.test(s)) return val * 1000;
            if (val > 100000) return val / 1000;
            return val;
        }

        function readBudget() {
            var el = document.getElementById('hMoney');
            if (!el) return null;
            var v = toK(el.innerText || el.textContent || '');
            return (v !== null && v > 0) ? v : null;
        }

        function getCookBtn() { return document.getElementById('cook'); }

        function isCookBlocked() {
            var b = getCookBtn();
            if (!b) return false;
            if (b.classList && (b.classList.contains('blocked') || b.classList.contains('disabled'))) return true;
            if (b.disabled === true) return true;
            if (b.getAttribute && (b.getAttribute('aria-disabled') === 'true' || b.hasAttribute('disabled'))) return true;
            var st = b.getAttribute && b.getAttribute('style');
            if (st && /pointer-events\s*:\s*none/i.test(st)) return true;
            return false;
        }

        function readCost() {
            var b = getCookBtn();
            if (!b) return null;
            var attr = b.getAttribute && (b.getAttribute('data-cost') || b.getAttribute('data-money'));
            if (attr) {
                var a = toK(attr);
                if (a !== null && a > 0) return a;
            }
            var v = toK(b.innerText || b.textContent || '');
            return (v !== null && v >= 0) ? v : null;
        }

        function isSafeToCook(budgetK, budgetKnown) {
            if (isCookBlocked()) return false;
            var c = readCost();
            if (c === null) return true;
            if (budgetKnown && c > budgetK) return false;
            return true;
        }

        // ==========================================================
        // 🗂 CAROUSEL — game dịch bằng transform nên mọi .rowi đều "visible"
        // => phải xác định đúng PAGE đang mở, nếu không sẽ mua trùng N lần
        // ==========================================================
        function getSwipe() { return document.getElementById('sw-kho') || document.querySelector('.swipe'); }

        function getActiveSpage() {
            var pages = document.querySelectorAll('.spage');
            if (!pages.length) return null;
            var swipe = getSwipe();
            if (!swipe || pages.length === 1) return pages[0];
            var sr = swipe.getBoundingClientRect();
            var center = sr.left + sr.width / 2;
            var best = null, bestD = Infinity;
            for (var i = 0; i < pages.length; i++) {
                var r = pages[i].getBoundingClientRect();
                if (!r.width && !r.height) continue;
                var d = Math.abs((r.left + r.width / 2) - center);
                if (d < bestD) { bestD = d; best = pages[i]; }
            }
            return best || pages[0];
        }

        function getActiveRows() {
            var page = getActiveSpage();
            if (!page) return [];
            return Array.prototype.slice.call(page.querySelectorAll('.rowi.kho'));
        }

        function getActiveTabSi() {
            var on = document.querySelector('.stabs[data-st="kho"] button.stab.on');
            return on ? on.getAttribute('data-si') : null;
        }

        async function selectTab(si) {
            var tab = document.querySelector('.stabs[data-st="kho"] button[data-si="' + si + '"]');
            if (!tab) return false;
            triggerFullClick(tab);
            await sleep(CFG.tabDelay);
            return true;
        }

        // ==========================================================
        // 📦 ĐỌC 1 MÓN HÀNG
        // ==========================================================
        function getPlanInput(btn) {
            var node = btn;
            for (var depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
                var inp = node.querySelector ? node.querySelector('input[data-plan]') : null;
                if (inp) return inp;
            }
            return null;
        }

        function planValue(inp) {
            if (!inp) return 0;
            var v = parseInt(inp.value || '0', 10);
            return (!isFinite(v) || v < 0) ? 0 : v;
        }

        function getRowInfo(row) {
            var nm = row.querySelector('.nm');
            var name = nm ? getNameText(nm) : '?';

            // .sub đầu tiên là tồn kho; .sub.okline là dòng chi phí kế hoạch
            var sub = row.querySelector('.sub:not(.okline)') || row.querySelector('.sub');
            var raw = sub ? String(sub.innerText || sub.textContent || '').replace(/\s+/g, ' ').trim() : '';
            var nums = raw.match(/\d+(?:[.,]\d+)?/g) || [];

            var stock = null, price = null;
            if (nums.length) stock = Math.round(parseFloat(nums[0].replace(',', '.'))) || 0;
            if (nums.length > 1) price = toK(nums[1] + 'k');

            var inp = row.querySelector('input[data-plan]');
            return {
                row: row,
                name: name,
                stock: stock,
                price: price,
                plan: inp ? planValue(inp) : 0,
                raw: raw
            };
        }

        function getNameText(nm) {
            var clone = nm.cloneNode(true);
            var spans = clone.querySelectorAll ? clone.querySelectorAll('span') : [];
            for (var i = 0; i < spans.length; i++) {
                if (spans[i].parentNode) spans[i].parentNode.removeChild(spans[i]);
            }
            return (clone.textContent || '').trim() || '?';
        }

        // ==========================================================
        // 🧮 QUY HOẠCH
        // ==========================================================
        function splitNeed(total, count) {
            if (count <= 0) return 0;
            var base = Math.floor(total / count);
            var extra = total - base * count;
            var out = [];
            for (var i = 0; i < count; i++) out.push(base + (i < extra ? 1 : 0));
            return out;
        }

        async function resetAllPlans() {
            var tabs = getWarehouseTabs();
            for (var t = 0; t < tabs.length; t++) {
                if (!(await selectTab(tabs[t]))) continue;
                for (var round = 0; round < 400; round++) {
                    var btns = document.querySelectorAll('.step5 button[data-v="-5"]');
                    var clicked = false;
                    for (var i = 0; i < btns.length; i++) {
                        var inp = getPlanInput(btns[i]);
                        if (inp && planValue(inp) > 0) { triggerFullClick(btns[i]); clicked = true; break; }
                    }
                    if (!clicked) break;
                    await sleep(12);
                }
            }
        }

        function getWarehouseTabs() {
            var out = [];
            var btns = document.querySelectorAll('.stabs[data-st="kho"] button[data-si]');
            for (var i = 0; i < btns.length; i++) {
                var si = btns[i].getAttribute('data-si');
                if (si !== null && out.indexOf(si) === -1) out.push(si);
            }
            return out.length ? out : ['0', '1', '2'];
        }

        // Quy hoạch 1 tab: target = nhu cầu chia đều + dự phòng, thiếu bao nhiêu thì bấm +5
        async function planTab(si, needEach, budgetK, budgetKnown, label) {
            if (!(await selectTab(si))) return { added: 0, count: 0 };

            var rows = getActiveRows();
            if (!rows.length) {
                console.warn('   ⚠️ Không tìm thấy món nào ở tab ' + label + ' (si=' + si + ').');
                return { added: 0, count: 0 };
            }

            var added = 0, unknown = 0;
            for (var j = 0; j < rows.length; j++) {
                var info = getRowInfo(rows[j]);
                if (info.stock === null) {
                    unknown++;
                    console.warn('   ⚠️ Không đọc được tồn kho [' + info.name + '] (raw="' + info.raw + '") → bỏ qua, không mù mắt mua.');
                    continue;
                }

                var need = needEach(j, rows.length, info);
                var gap = need - info.stock;
                if (gap <= 0) {
                    console.log('   📦 ' + info.name + ': tồn ' + info.stock + ' ≥ cần ' + need + ' → không mua.');
                    continue;
                }

                var clicks = Math.min(CFG.maxAddClicksPerRow, Math.ceil(gap / 5));
                var stopped = false;
                for (var c = 0; c < clicks; c++) {
                    var plus = rows[j].querySelector('.step5 button[data-v="5"]');
                    if (!plus) break;
                    triggerFullClick(plus);
                    added += 5;
                    await sleep(CFG.clickDelay);
                    if (budgetKnown && !isSafeToCook(budgetK, true)) {
                        console.warn('   ⚠️ Chạm trần ngân sách ở [' + info.name + '] → dừng cộng thêm.');
                        stopped = true;
                        break;
                    }
                }
                console.log('   📦 ' + info.name + ': tồn ' + info.stock + ' → cần ' + need +
                            ' | bấm +5 ' + c + ' lần (+' + (c * 5) + ')' + (stopped ? ' [dừng vì ví]' : '') +
                            (info.price !== null ? ' | đơn giá ' + info.price + 'k' : ''));
            }
            return { added: added, count: rows.length, unknown: unknown };
        }

        // Cắt giảm: bỏ qua isVisible vì carousel đẩy mọi page ra ngoài màn hình
        function collectReduceButtons() {
            var out = [];
            var all = document.querySelectorAll('.step5 button[data-v="-5"]');
            for (var i = 0; i < all.length; i++) {
                var inp = getPlanInput(all[i]);
                if (!inp) continue;
                var v = planValue(inp);
                if (v > 0) out.push({ btn: all[i], val: v });
            }
            return out;
        }

        async function reduceToBudget(budgetK, budgetKnown) {
            var rot = 0, stuck = 0, lastCost = null;
            for (var round = 0; round < CFG.maxReduceRounds; round++) {
                if (isSafeToCook(budgetK, budgetKnown)) return true;

                var cands = collectReduceButtons();
                if (!cands.length) return false;
                cands.sort(function(a, b) { return b.val - a.val; });

                var pick = cands[rot % cands.length];
                if (!pick || pick.btn.isConnected === false) { rot++; continue; }
                triggerFullClick(pick.btn);
                await sleep(CFG.clickDelay);

                var nc = readCost();
                if (nc !== null && lastCost !== null && nc >= lastCost) { stuck++; rot++; }
                else { stuck = 0; rot = 0; }
                lastCost = nc;

                if (stuck > 8) {
                    console.warn('   ⚠️ Chi phí không giảm sau nhiều lần bấm → dừng cắt giảm.');
                    return false;
                }
            }
            return isSafeToCook(budgetK, budgetKnown);
        }

        // ==========================================================
        // ⚡ NÚT AUTO NHẬP HÀNG
        // ==========================================================
        var prepBusy = false;
        var btnPrep = document.getElementById('btn-prep');

        btnPrep.addEventListener('click', async function() {
            if (prepBusy) { console.warn('⏳ Đang chạy dở, chờ xong đã hẵng bấm lại.'); return; }
            prepBusy = true; btnPrep.disabled = true; btnPrep.style.opacity = '0.6';

            try {
                console.log('\n==================================================');
                console.log('📦 [SMART-BUDGET v32.0] BẮT ĐẦU NHẬP HÀNG');
                console.log('==================================================');

                var budget = readBudget();
                var budgetKnown = budget !== null && budget > 0;
                if (!budgetKnown) {
                    budget = CFG.fallbackBudget;
                    console.warn('💰 Không đọc được #hMoney — dùng ngân sách dự phòng ' + budget + 'k.');
                } else {
                    console.log('💰 Ví hiện tại có: ' + budget + 'k');
                }

                var foreEl = document.querySelector('.fore.big2') || document.querySelector('.fore');
                var customers = 20;
                if (foreEl) {
                    var mC = (foreEl.innerText || '').match(/\d+/);
                    if (mC) customers = Math.min(500, Math.max(1, parseInt(mC[0], 10)));
                }
                console.log('👥 Dự báo khách hôm nay: ~' + customers + ' người');

                var demand = customers * CFG.cupsPerCustomer;
                console.log('🎯 Nhu cầu: ' + demand + ' ly' +
                            ' | topping ~' + Math.round(demand * CFG.toppingPerCustomer) +
                            ' | dự phòng ' + CFG.restockBuffer);

                var khoTab = document.querySelector('.tab[data-tab="kho"]');
                if (khoTab) { triggerFullClick(khoTab); await sleep(250); }

                console.log('🧹 Đang đưa toàn bộ kế hoạch về 0...');
                await resetAllPlans();
                await sleep(150);

                // 1) TRÀ — chia đều nhu cầu, ly luôn đủ bằng tổng phần trà
                await selectTab('0');
                var teaCount = getActiveRows().length;
                var teaPlan = splitNeed(demand, teaCount);
                var teaSum = 0;
                for (var t2 = 0; t2 < teaPlan.length; t2++) teaSum += teaPlan[t2];

                var rTea = await planTab('0', function(j, n) {
                    return teaPlan[j] + CFG.restockBuffer;
                }, budget, budgetKnown, 'Trà');
                console.log('   → Trà: ' + teaCount + ' món, tổng kế hoạch ' + teaSum + ' phần.');

                // 2) TOPPING — trung bình toppingPerCustomer mỗi khách
                var toppingNeed = Math.max(1, Math.round(demand * CFG.toppingPerCustomer));
                await planTab('1', function(j, n) {
                    return Math.max(1, Math.round(toppingNeed / n)) + CFG.restockBuffer;
                }, budget, budgetKnown, 'Topping');

                // 3) LY — phải đủ bằng tổng phần trà vừa quy hoạch
                var cupNeed = Math.max(demand, teaSum);
                var rCup = await planTab('2', function() {
                    return cupNeed + CFG.restockBuffer;
                }, budget, budgetKnown, 'Ly');
                console.log('   → Ly: cần ' + cupNeed + ' (theo số khách và tổng phần trà).');

                if (rTea.unknown || rCup.unknown) {
                    console.warn('⚠️ Có món không đọc được tồn kho → xem lại log ở trên.');
                }

                await sleep(300);
                var st = { cost: readCost(), blocked: isCookBlocked() };
                console.log('💡 [KIỂM TRA VỐN] Chi phí: ' + (st.cost === null ? '?' : st.cost + 'k') +
                            ' | Ví: ' + budget + 'k' + (st.blocked ? ' | 🔒 nút NẤu bị khoá' : ''));

                if (!isSafeToCook(budget, budgetKnown)) {
                    console.warn('⚠️ [KHỬ KẸT] Vượt ví hoặc nút nấu bị khoá → đang cắt giảm...');
                    await reduceToBudget(budget, budgetKnown);
                }

                var fin = { cost: readCost(), blocked: isCookBlocked() };
                if (!isSafeToCook(budget, budgetKnown)) {
                    console.error('❌ [DỪNG] Vẫn không đủ điều kiện (chi phí ' +
                                  (fin.cost === null ? '?' : fin.cost + 'k') + ', khóa: ' + fin.blocked +
                                  ') → KHÔNG bấm NẤU để tránh lỗi 999999k.');
                    return;
                }
                if (fin.cost === null) console.warn('⚠️ Không đọc được chi phí để xác nhận, tiến hành nấu.');

                console.log('🔥 Chi phí ' + fin.cost + 'k ≤ ' + budget + 'k → bấm NẤU.');
                triggerFullClick(getCookBtn());
                console.log('==================================================\n');
            } catch (err) {
                console.error('💥 [LỖI] Auto nhập hàng dừng đột ngột:', err);
            } finally {
                prepBusy = false; btnPrep.disabled = false; btnPrep.style.opacity = '1';
            }
        });

        // ==========================================================
        // 🔍 CHẨN ĐOÁN
        // ==========================================================
        document.getElementById('btn-diag').addEventListener('click', function() {
            var L = [];
            L.push('===== CHẨN ĐOÁN v32.0 =====');
            L.push('#hMoney: ' + (document.getElementById('hMoney') ? document.getElementById('hMoney').innerText : 'KHÔNG CÓ'));
            L.push('.fore: ' + (document.querySelector('.fore') ? document.querySelector('.fore').innerText : 'KHÔNG CÓ'));

            var cook = getCookBtn();
            L.push('#cook: ' + (cook ? cook.outerHTML.replace(/\s+/g, ' ') : 'KHÔNG CÓ (chưa tới bước nấu?)'));
            L.push('readCost = ' + readCost() + ' | blocked = ' + isCookBlocked());

            var swipe = getSwipe();
            L.push('swipe: ' + (swipe ? '#' + swipe.id + ' w=' + Math.round(swipe.getBoundingClientRect().width) : 'KHÔNG CÓ'));
            L.push('tab active: data-si=' + getActiveTabSi());
            L.push('số .spage = ' + document.querySelectorAll('.spage').length +
                   ' | số .rowi.kho (toàn bộ) = ' + document.querySelectorAll('.rowi.kho').length);

            var act = getActiveSpage();
            L.push('page đang mở: ' + (act ? '#' + (Array.prototype.indexOf.call(document.querySelectorAll('.spage'), act)) : '?'));
            if (act) {
                Array.prototype.slice.call(document.querySelectorAll('.spage')).forEach(function(p, i) {
                    var r = p.getBoundingClientRect();
                    L.push('  spage[' + i + '] left=' + Math.round(r.left) + ' w=' + Math.round(r.width) +
                           (i === Array.prototype.indexOf.call(document.querySelectorAll('.spage'), act) ? '  <== ACTIVE' : ''));
                });
            }

            L.push('--- Món trong page đang mở ---');
            getActiveRows().forEach(function(row) {
                var inf = getRowInfo(row);
                L.push('  ' + inf.name + ' | tồn=' + inf.stock + ' | giá=' + inf.price +
                       'k | kế hoạch=' + inf.plan + ' | raw="' + inf.raw + '"');
            });

            L.push('--- Món ngoài page đang mở (bị carousel đẩy) ---');
            Array.prototype.slice.call(document.querySelectorAll('.rowi.kho')).forEach(function(row) {
                if (act && act.contains(row)) return;
                var inf = getRowInfo(row);
                L.push('  ' + inf.name + ' | tồn=' + inf.stock + ' | giá=' + inf.price + 'k | raw="' + inf.raw + '"');
            });

            L.push('--- Nút -5 sẽ bị bấm khi cắt giảm ---');
            L.push('  tổng số nút -5 = ' + document.querySelectorAll('.step5 button[data-v="-5"]').length);
            console.log(L.join('\n'));
        });

        // ==========================================================
        // 🍵 VÒNG LẶP TỰ ĐỘNG PHỤC VỤ KHÁCH
        // ==========================================================
        var chkAutoCup = document.getElementById('chk-autocup');
        var chkAutoFill = document.getElementById('chk-autofill');
        var lastSayText = "", lastWidth = 0, lastWidthTime = 0;
        var isPumpingState = false, currentPressingEl = null, lastPressTime = 0;
        var cupSizeCache = { t: 0, val: null };

        setInterval(runAutoLoop, CFG.loopMs);

        function getCupSizeOnBoard() {
            var now = Date.now();
            if (now - cupSizeCache.t < 300) return cupSizeCache.val;
            var texts = document.querySelectorAll('svg text, svg tspan');
            var found = null;
            for (var i = 0; i < texts.length; i++) {
                var t = (texts[i].textContent || '').trim().toUpperCase();
                if (t === 'M' || t === 'L') { found = t; break; }
            }
            cupSizeCache = { t: now, val: found };
            return found;
        }

        function runAutoLoop() {
            var sayEl = document.getElementById('q3say');
            var currentSayText = sayEl ? sayEl.innerText.trim() : "";

            if (currentSayText !== lastSayText) {
                if (currentPressingEl) { stopPress(currentPressingEl); currentPressingEl = null; }
                lastSayText = currentSayText;
                lastWidth = 0; lastWidthTime = 0; isPumpingState = false; lastPressTime = 0;
            }
            if (currentPressingEl && currentPressingEl.isConnected === false) currentPressingEl = null;

            if (chkAutoCup.checked && currentSayText && !/ngồi chơi|đang chờ khách/i.test(currentSayText)) {
                var needsM = /\bsize\s*M\b|\bly\s+M\b/i.test(currentSayText);
                var needsL = /\bsize\s*L\b|\bly\s+L\b/i.test(currentSayText);
                var requiredSize = needsM ? 'M' : (needsL ? 'L' : null);

                if (requiredSize) {
                    var cupOnBoard = getCupSizeOnBoard();
                    var btnM = document.getElementById('q3_M') || document.querySelector('[data-a="size:M"]');
                    var btnL = document.getElementById('q3_L') || document.querySelector('[data-a="size:L"]');
                    var trashBtn = document.getElementById('q3trash') || document.querySelector('[data-a="trash"]');

                    if (cupOnBoard && cupOnBoard !== requiredSize) {
                        if (trashBtn) triggerFullClick(trashBtn);
                        return;
                    }
                    if (!cupOnBoard) {
                        if (requiredSize === 'M' && btnM) triggerFullClick(btnM);
                        else if (requiredSize === 'L' && btnL) triggerFullClick(btnL);
                    }
                }
            }

            if (chkAutoFill.checked) {
                var gaugeLv = document.getElementById('q3gLv');
                if (gaugeLv && gaugeLv.offsetParent !== null) {
                    var currentWidth = parseFloat(gaugeLv.style.width || '0');
                    var now = Date.now();

                    if (isPumpingState) {
                        if (currentWidth >= 80) {
                            if (currentPressingEl) { stopPress(currentPressingEl); currentPressingEl = null; }
                            isPumpingState = false;
                        } else {
                            var target = getTeaTargetBtn(currentSayText);
                            if (target && (currentPressingEl !== target || now - lastPressTime > CFG.pressRepeatMs)) {
                                if (currentPressingEl && currentPressingEl !== target) stopPress(currentPressingEl);
                                currentPressingEl = target;
                                lastPressTime = now;
                                startPress(target);
                            }
                        }
                        return;
                    }

                    if (currentWidth !== lastWidth) { lastWidth = currentWidth; lastWidthTime = now; return; }

                    if (currentWidth > 0 && currentWidth < 80 && (now - lastWidthTime > 250)) {
                        isPumpingState = true;
                        lastPressTime = 0;
                        var first = getTeaTargetBtn(currentSayText);
                        if (first) { currentPressingEl = first; lastPressTime = Date.now(); startPress(first); }
                    }
                } else {
                    if (currentPressingEl) { stopPress(currentPressingEl); currentPressingEl = null; }
                    isPumpingState = false;
                }
            }
        }

        function getTeaTargetBtn(currentSayText) {
            var target = document.querySelector('.q3jar.q3want');
            if (target) return target;
            if (currentSayText) {
                if (/thái/i.test(currentSayText)) return document.getElementById('q3b_thai');
                if (/matcha/i.test(currentSayText)) return document.getElementById('q3b_matcha');
                if (/hồng/i.test(currentSayText)) return document.getElementById('q3b_hong');
                if (/lục/i.test(currentSayText)) return document.getElementById('q3b_luc');
                if (/olong|ô long/i.test(currentSayText)) return document.getElementById('q3b_olong');
                if (/trà sữa/i.test(currentSayText)) return document.getElementById('q3b_tra');
            }
            return null;
        }

        console.log('✅ [TAMPERMONKEY] Auto Tiệm Trà v32.0 (carousel-safe + demand planning) đã kích hoạt!');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initMod, 500);
    } else {
        window.addEventListener('DOMContentLoaded', initMod);
    }
})();
