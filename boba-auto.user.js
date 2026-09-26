// ==UserScript==
// @name         Auto Tiem Tra Nho
// @namespace    http://tampermonkey.net/
// @version      20260926152721
// @description  Quy hoạch kho theo nhu cầu khách, chặn lỗi 999999k, và tự phục vụ: lấy ly - rót đúng trà - thêm topping - dán nắp giao ly
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
        // ---------- hiển thị ----------
        // @name và @namespace PHẢI cố định, nếu không Tampermonkey sẽ cài bản sao mới
        // thay vì update bản cũ. Nên version hiển thị nằm ở đây, bump cùng @version.
        appVersion: '33.0',

        // ---------- kho ----------
        fallbackBudget: 50,
        clickDelay: 40,
        tabDelay: 320,
        maxReduceRounds: 60,
        cupsPerCustomer: 1,
        toppingPerCustomer: 0.5,
        restockBuffer: 5,
        maxAddClicksPerRow: 10,

        // ---------- phục vụ ----------
        loopMs: 60,
        pourTargetPct: 'auto',   // 'auto' = đọc vạch xanh .q3ok
        pourMinPct: 82,          // CHỈ dán nắp khi rót đạt tối thiểu mức này
        pourTargetFallback: 82,  // khi không đọc được .q3ok
        pressRepeatMs: 600,      // giữ nút rót, nhắc lại mỗi 600ms
        maxPourMs: 8000,         // rót quá lâu thì bỏ qua (chống kẹt)
        tapDelayMs: 450,         // giữa 2 lần bấm topping
        toppingHoldMs: 140,      // giữ nút topping (chịu được cả tap lẫn hold)
        maxToppingTaps: 2,       // tối đa bấm topping mấy lần, tránh dư
        toppingMaxMs: 2500,      // topping thêm mãi không được thì bỏ qua
        sealDelayMs: 400,        // chờ trước khi dán nắp
        cupClickGapMs: 700
    };

    function initMod() {
        if (document.getElementById('mod-menu')) {
            console.warn('⚠️ [BobaAuto] Đang chạy nhiều bản cài đặt cùng lúc!\n' +
                         '   Tampermonkey nhận diện script bằng @name + @namespace. Nếu 2 bản có cặp này khác nhau\n' +
                         '   thì nó cài thêm thay vì update. Vào Tampermonkey → Dashboard → gỡ bản cũ, chỉ giữ 1 bản.');
            return;
        }

        var iconEl = document.createElement('div');
        iconEl.id = 'mod-icon';
        iconEl.innerHTML = '🧋';
        iconEl.title = 'Bấm để mở menu / Kéo thả di chuyển';
        iconEl.style.cssText = 'position:fixed; top:20px; right:20px; width:46px; height:46px; border-radius:50%; background:#e74c3c; color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 12px rgba(0,0,0,0.4); cursor:move; z-index:999999; user-select:none; touch-action:none; border:2px solid #ffffff;';
        document.body.appendChild(iconEl);

        var menuEl = document.createElement('div');
        menuEl.id = 'mod-menu';
        menuEl.style.cssText = 'position:fixed; top:75px; right:20px; width:255px; background:rgba(44, 62, 80, 0.95); color:#ecf0f1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.4); font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index:999999; overflow:hidden; border:1px solid #34495e; display:none; flex-direction:column;';

        var headerEl = document.createElement('div');
        headerEl.style.cssText = 'background:#e74c3c; padding:8px 12px; font-weight:bold; font-size:13px; display:flex; justify-content:space-between; align-items:center;';
        headerEl.innerHTML = '<span>🧋 Auto Tiệm Trà v' + CFG.appVersion + '</span><button id="mod-close-btn" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; font-size:14px;">✕</button>';
        menuEl.appendChild(headerEl);

        var row = 'display:flex; align-items:center; gap:8px; font-size:12px;';
        var lbl = 'display:flex; align-items:center; gap:8px; cursor:pointer;';
        var bodyEl = document.createElement('div');
        bodyEl.style.cssText = 'padding:10px; display:flex; flex-direction:column; gap:8px;';
        bodyEl.innerHTML =
            '<button id="btn-prep" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; text-align:center;">⚡ Auto Nhập Hàng Thông Minh</button>' +
            '<button id="btn-diag" style="background:#2980b9; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold; font-size:12px; cursor:pointer; text-align:center;">🔍 Chẩn Đoán DOM</button>' +
            '<hr style="border:0; border-top:1px solid #34495e; margin:4px 0;">' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autocup" checked><b>1. Lấy ly đúng size</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autofill" checked><b>2. Rót đúng trà (≥ 82% mới dán nắp)</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autotop" checked><b>3. Thêm topping khách gọi</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autoseal" checked><b>4. Dán nắp &amp; giao ly</b></label></div>' +
            '<hr style="border:0; border-top:1px solid #34495e; margin:4px 0;">' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-trace" checked><b>Trace log (tắt khi ổn)</b></label></div>';
        menuEl.appendChild(bodyEl);
        document.body.appendChild(menuEl);

        // ---------------- kéo thả icon ----------------
        var isDragging = false, startX, startY, initialLeft, initialTop, hasMoved = false;

        function onPointerDown(e) {
            isDragging = true; hasMoved = false;
            startX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            var rect = iconEl.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            iconEl.style.right = 'auto';
            iconEl.style.left = initialLeft + 'px';
            iconEl.style.top = initialTop + 'px';
        }
        function onPointerMove(e) {
            if (!isDragging) return;
            var cx = e.touches ? e.touches[0].clientX : e.clientX;
            var cy = e.touches ? e.touches[0].clientY : e.clientY;
            var dx = cx - startX, dy = cy - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            iconEl.style.left = Math.max(5, Math.min(window.innerWidth - 50, initialLeft + dx)) + 'px';
            iconEl.style.top = Math.max(5, Math.min(window.innerHeight - 50, initialTop + dy)) + 'px';
            if (menuEl.style.display === 'flex') updateMenuPos(initialLeft + dx, initialTop + dy);
        }
        function onPointerUp() { isDragging = false; }
        function updateMenuPos(iLeft, iTop) {
            menuEl.style.left = Math.max(10, Math.min(window.innerWidth - 260, iLeft - 185)) + 'px';
            menuEl.style.top = (iTop + 52 > window.innerHeight - 210 ? iTop - 160 : iTop + 52) + 'px';
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
                var hidden = menuEl.style.display === 'none' || menuEl.style.display === '';
                menuEl.style.display = hidden ? 'flex' : 'none';
                if (hidden) {
                    var r = iconEl.getBoundingClientRect();
                    updateMenuPos(r.left, r.top);
                }
            }
        });
        document.getElementById('mod-close-btn').addEventListener('click', function() { menuEl.style.display = 'none'; });

        // ---------------- sự kiện giả ----------------
        function fire(el, types) {
            if (!el || el.isConnected === false) return;
            for (var i = 0; i < types.length; i++) {
                try {
                    var ev = types[i].indexOf('touch') === 0
                        ? new Event(types[i], { bubbles: true, cancelable: true })
                        : new MouseEvent(types[i], { bubbles: true, cancelable: true, view: window });
                    el.dispatchEvent(ev);
                } catch (e) {}
            }
        }
        function triggerFullClick(el) {
            fire(el, ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']);
        }
        function startPress(el) { fire(el, ['pointerdown', 'mousedown', 'touchstart']); }
        function stopPress(el) { fire(el, ['pointerup', 'mouseup', 'touchend', 'click']); }

        function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

        function trace() {
            if (!document.getElementById('chk-trace').checked) return;
            console.log.apply(console, ['[BobaAuto]'].concat(Array.prototype.slice.call(arguments)));
        }

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
            return !!(st && /pointer-events\s*:\s*none/i.test(st));
        }

        function readCost() {
            var b = getCookBtn();
            if (!b) return null;
            var attr = b.getAttribute && (b.getAttribute('data-cost') || b.getAttribute('data-money'));
            if (attr) { var a = toK(attr); if (a !== null && a > 0) return a; }
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
        // 🗂 CAROUSEL KHO — game dịch bằng transform nên mọi .rowi đều "visible"
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

        function getWarehouseTabs() {
            var out = [], btns = document.querySelectorAll('.stabs[data-st="kho"] button[data-si]');
            for (var i = 0; i < btns.length; i++) {
                var si = btns[i].getAttribute('data-si');
                if (si !== null && out.indexOf(si) === -1) out.push(si);
            }
            return out.length ? out : ['0', '1', '2'];
        }

        async function selectTab(si) {
            var tab = document.querySelector('.stabs[data-st="kho"] button[data-si="' + si + '"]');
            if (!tab) return false;
            triggerFullClick(tab);
            await sleep(CFG.tabDelay);
            return true;
        }

        function getPlanInput(btn) {
            var node = btn;
            for (var d = 0; d < 5 && node; d++, node = node.parentElement) {
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

        function isVisible(el) {
            if (!el) return false;
            if (el.offsetParent !== null) return true;
            return !!(el.getClientRects && el.getClientRects().length);
        }

        function getNameText(nm) {
            var clone = nm.cloneNode(true);
            var spans = clone.querySelectorAll ? clone.querySelectorAll('span') : [];
            for (var i = 0; i < spans.length; i++) {
                if (spans[i].parentNode) spans[i].parentNode.removeChild(spans[i]);
            }
            return (clone.textContent || '').trim() || '?';
        }

        function getRowInfo(row) {
            var nm = row.querySelector('.nm');
            var sub = row.querySelector('.sub:not(.okline)') || row.querySelector('.sub');
            var raw = sub ? String(sub.innerText || sub.textContent || '').replace(/\s+/g, ' ').trim() : '';
            var nums = raw.match(/\d+(?:[.,]\d+)?/g) || [];
            var inp = row.querySelector('input[data-plan]');
            return {
                row: row,
                name: nm ? getNameText(nm) : '?',
                stock: nums.length ? Math.round(parseFloat(nums[0].replace(',', '.'))) || 0 : null,
                price: nums.length > 1 ? toK(nums[1] + 'k') : null,
                plan: inp ? planValue(inp) : 0,
                raw: raw
            };
        }

        function splitNeed(total, count) {
            if (count <= 0) return 0;
            var base = Math.floor(total / count), extra = total - base * count, out = [];
            for (var i = 0; i < count; i++) out.push(base + (i < extra ? 1 : 0));
            return out;
        }

        // ==========================================================
        // 📦 QUY HOẠCH KHO
        // ==========================================================
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

        async function planTab(si, needEach, budgetK, budgetKnown, label) {
            if (!(await selectTab(si))) return { added: 0, count: 0, unknown: 0 };
            var rows = getActiveRows();
            if (!rows.length) { console.warn('   ⚠️ Không tìm thấy món nào ở tab ' + label + '.'); return { added: 0, count: 0, unknown: 0 }; }

            var added = 0, unknown = 0;
            for (var j = 0; j < rows.length; j++) {
                var info = getRowInfo(rows[j]);
                if (info.stock === null) {
                    unknown++;
                    console.warn('   ⚠️ Không đọc được tồn kho [' + info.name + '] (raw="' + info.raw + '") → bỏ qua.');
                    continue;
                }
                var need = needEach(j, rows.length, info);
                var gap = need - info.stock;
                if (gap <= 0) { console.log('   📦 ' + info.name + ': tồn ' + info.stock + ' ≥ cần ' + need + ' → không mua.'); continue; }

                var clicks = Math.min(CFG.maxAddClicksPerRow, Math.ceil(gap / 5));
                var done = 0;
                for (var c = 0; c < clicks; c++) {
                    var plus = rows[j].querySelector('.step5 button[data-v="5"]');
                    if (!plus) break;
                    triggerFullClick(plus);
                    added += 5; done++;
                    await sleep(CFG.clickDelay);
                    if (budgetKnown && !isSafeToCook(budgetK, true)) {
                        console.warn('   ⚠️ Chạm trần ngân sách ở [' + info.name + '] → dừng.');
                        break;
                    }
                }
                console.log('   📦 ' + info.name + ': tồn ' + info.stock + ' → cần ' + need + ' | +5 ×' + done +
                            (info.price !== null ? ' | ' + info.price + 'k/phần' : ''));
            }
            return { added: added, count: rows.length, unknown: unknown };
        }

        function collectReduceButtons() {
            var out = [], all = document.querySelectorAll('.step5 button[data-v="-5"]');
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
                if (stuck > 8) { console.warn('   ⚠️ Chi phí không giảm → dừng cắt giảm.'); return false; }
            }
            return isSafeToCook(budgetK, budgetKnown);
        }

        var prepBusy = false;
        var btnPrep = document.getElementById('btn-prep');

        btnPrep.addEventListener('click', async function() {
            if (prepBusy) { console.warn('⏳ Đang chạy dở.'); return; }
            prepBusy = true; btnPrep.disabled = true; btnPrep.style.opacity = '0.6';
            try {
                console.log('\n==================================================');
                console.log('📦 [SMART-BUDGET v' + CFG.appVersion + '] BẮT ĐẦU NHẬP HÀNG');
                console.log('==================================================');

                var budget = readBudget();
                var budgetKnown = budget !== null && budget > 0;
                if (!budgetKnown) { budget = CFG.fallbackBudget; console.warn('💰 Không đọc được #hMoney — dùng ' + budget + 'k.'); }
                else console.log('💰 Ví: ' + budget + 'k');

                var foreEl = document.querySelector('.fore.big2') || document.querySelector('.fore');
                var customers = 20;
                if (foreEl) {
                    var mC = (foreEl.innerText || '').match(/\d+/);
                    if (mC) customers = Math.min(500, Math.max(1, parseInt(mC[0], 10)));
                }
                var demand = customers * CFG.cupsPerCustomer;
                console.log('👥 Khách: ~' + customers + ' → nhu cầu ' + demand + ' ly');

                var khoTab = document.querySelector('.tab[data-tab="kho"]');
                if (khoTab) { triggerFullClick(khoTab); await sleep(250); }

                console.log('🧹 Đưa toàn bộ kế hoạch về 0...');
                await resetAllPlans();
                await sleep(150);

                await selectTab('0');
                var teaCount = getActiveRows().length;
                var teaPlan = splitNeed(demand, teaCount);
                var teaSum = 0;
                for (var t2 = 0; t2 < teaPlan.length; t2++) teaSum += teaPlan[t2];
                await planTab('0', function(j) { return teaPlan[j] + CFG.restockBuffer; }, budget, budgetKnown, 'Trà');
                console.log('   → Trà: ' + teaCount + ' món, tổng ' + teaSum + ' phần.');

                var toppingNeed = Math.max(1, Math.round(demand * CFG.toppingPerCustomer));
                await planTab('1', function(j, n) { return Math.max(1, Math.round(toppingNeed / n)) + CFG.restockBuffer; }, budget, budgetKnown, 'Topping');

                var cupNeed = Math.max(demand, teaSum);
                await planTab('2', function() { return cupNeed + CFG.restockBuffer; }, budget, budgetKnown, 'Ly');
                console.log('   → Ly: cần ' + cupNeed + '.');

                await sleep(300);
                var st = { cost: readCost(), blocked: isCookBlocked() };
                console.log('💡 Chi phí: ' + (st.cost === null ? '?' : st.cost + 'k') + ' | Ví: ' + budget + 'k' + (st.blocked ? ' | 🔒 bị khoá' : ''));

                if (!isSafeToCook(budget, budgetKnown)) {
                    console.warn('⚠️ [KHỬ KẸT] Đang cắt giảm theo từng tab...');
                    await reduceToBudget(budget, budgetKnown);
                }

                var fin = { cost: readCost(), blocked: isCookBlocked() };
                if (!isSafeToCook(budget, budgetKnown)) {
                    console.error('❌ [DỪNG] Chi phí ' + (fin.cost === null ? '?' : fin.cost + 'k') + ', khóa: ' + fin.blocked + ' → KHÔNG bấm NẤU.');
                    return;
                }
                console.log('🔥 ' + fin.cost + 'k ≤ ' + budget + 'k → bấm NẤU.');
                triggerFullClick(getCookBtn());
                console.log('==================================================\n');
            } catch (err) {
                console.error('💥 [LỖI]', err);
            } finally {
                prepBusy = false; btnPrep.disabled = false; btnPrep.style.opacity = '1';
            }
        });

        // ==========================================================
        // 🍵 PHỤC VỤ — MÁY TRẠNG THÁI
        //   cup -> pour -> topping -> seal
        // ==========================================================
        var TEAS = [
            { key: 'matcha', re: /matcha/i },
            { key: 'hong',   re: /hồng\s*trà/i },
            { key: 'luc',    re: /lục\s*trà/i },
            { key: 'olong',  re: /ol?long|ô\s*long/i },
            { key: 'thai',   re: /thái|thai/i },
            { key: 'tra',    re: /trà\s*sữa|trà\s*đen|trà\s*đào|trà\s*chanh/i }
        ];

        var chkCup = document.getElementById('chk-autocup');
        var chkPour = document.getElementById('chk-autofill');
        var chkTop = document.getElementById('chk-autotop');
        var chkSeal = document.getElementById('chk-autoseal');

        function freshServe() {
            return {
                order: null, phase: 'cup', phaseAt: Date.now(),
                target: null, targetAt: 0, pressing: null, lastPress: 0,
                lastPct: null, lastPctAt: Date.now(), rate: 0,
                lastTop: 0, topTries: 0, popsBefore: -1,
                lastCupClick: 0, trashAt: 0, lastPhaseLog: ''
            };
        }
        var SERVE = freshServe();

        function getOrderText() {
            var el = document.getElementById('q3say');
            return el ? String(el.innerText || '').replace(/\s+/g, ' ').trim() : '';
        }
        function getZones() { return document.getElementById('q3zones'); }
        function selling() { return document.body.classList.contains('selling'); }

        function hasCup() {
            var noCup = document.getElementById('q3noCup');
            if (noCup && isVisible(noCup)) return false;
            var cup = document.getElementById('q3cup');
            return !!(cup && cup.getClientRects && cup.getClientRects().length);
        }
        function cupSealed() {
            var cup = document.getElementById('q3cup');
            if (!cup) return false;
            var lid = cup.querySelector('img.q3lid');
            return !!(lid && !lid.hasAttribute('hidden') && lid.style.display !== 'none');
        }
        function getCupSize() {
            var cup = document.getElementById('q3cup');
            if (!cup) return null;
            var texts = cup.querySelectorAll('svg text, svg tspan');
            for (var i = 0; i < texts.length; i++) {
                var t = (texts[i].textContent || '').trim().toUpperCase();
                if (t === 'M' || t === 'L') return t;
            }
            return null;
        }
        function getWantedSize(say) {
            var m = say.match(/size\s*([ML])\b/i) || say.match(/ly\s*([ML])\b/i);
            return m ? m[1].toUpperCase() : null;
        }
        function getPourPct() {
            var lv = document.getElementById('q3gLv');
            if (!lv) return null;
            var w = parseFloat(lv.style.width || '0');
            return isFinite(w) ? w : null;
        }
        // vạch xanh .q3ok = mức "hoàn hảo" của game, đọc ra được thì dùng
        function getAutoPourLine() {
            var gauge = document.querySelector('.q3gauge');
            var ok = gauge ? gauge.querySelector('.q3ok') : null;
            if (!ok || !gauge || gauge.clientWidth <= 0) return null;
            var pct = (ok.offsetLeft / gauge.clientWidth) * 100;
            return (isFinite(pct) && pct > 5 && pct < 100) ? pct : null;
        }
        // mục tiêu rót = max(vạch xanh, pourMinPct) -> không bao giờ dán nắp dưới 82%
        function getPourTarget() {
            var t;
            if (typeof CFG.pourTargetPct === 'number') {
                t = CFG.pourTargetPct;
            } else {
                var auto = getAutoPourLine();
                if (auto === null) auto = CFG.pourTargetFallback;
                t = Math.max(auto, CFG.pourMinPct);
            }
            return Math.min(t, 99);
        }
        // game tự đánh dấu hũ trà khách đang gọi bằng class .q3want
        function getWantedTeaBtn() {
            var z = getZones();
            if (!z) return null;
            var mark = z.querySelector('.q3jar.q3want:not(.q3lock)');
            if (mark) return mark;
            var say = getOrderText();
            for (var i = 0; i < TEAS.length; i++) {
                if (!TEAS[i].re.test(say)) continue;
                var b = z.querySelector('.q3jar[data-tea="' + TEAS[i].key + '"]:not(.q3lock)');
                if (b) return b;
            }
            return null;
        }
        // topping cũng được đánh dấu .q3want, phân biệt bằng data-a^="top:"
        function getWantedTopBtn() {
            var z = getZones();
            return z ? z.querySelector('.q3z.q3want[data-a^="top:"]:not(.q3lock)') : null;
        }
        function topName(btn) {
            return btn ? (btn.getAttribute('aria-label') || btn.id || '?') : '?';
        }
        function toppingSatisfied(top, st) {
            if (!top) return true;
            if (top.hasAttribute('hidden') || top.style.display === 'none') return true;
            if (/q3on|q3done|q3used|q3had/.test(top.className)) return true;
            if (!/\bq3want\b/.test(top.className)) return true;
            var pops = document.getElementById('q3pops');
            if (pops && st.popsBefore >= 0 && pops.childElementCount > st.popsBefore) return true;
            return false;
        }

        function releasePour() {
            if (SERVE.pressing) { stopPress(SERVE.pressing); SERVE.pressing = null; }
        }
        function setPhase(p, note) {
            if (SERVE.phase === p) return;
            SERVE.phase = p;
            SERVE.phaseAt = Date.now();
            trace('→ ' + p + (note ? ' (' + note + ')' : ''));
        }

        function stepServe() {
            if (!selling()) { releasePour(); return; }
            var now = Date.now();
            var say = getOrderText();
            var st = SERVE;

            if (say !== st.order) {
                releasePour();
                st = SERVE = freshServe();
                st.order = say;
                if (say) trace('📝 order: "' + say + '"');
            }

            var idle = !say || /ngồi chơi|đang chờ khách|chờ khách|hết khách/i.test(say);
            if (idle) {
                releasePour();
                var p = getPourPct();
                if (p !== null && p > 1 && !cupSealed() && hasCup() && now - st.trashAt > 1500) {
                    var tr = document.getElementById('q3trash');
                    if (tr) { triggerFullClick(tr); st.trashAt = now; trace('🗑️ đổ ly sót (' + p.toFixed(1) + '%)'); }
                }
                st.phase = 'cup';
                return;
            }

            // ---- 1. LẤY LY ----
            if (!hasCup()) {
                releasePour();
                st.phase = 'cup';
                if (chkCup.checked && now - st.lastCupClick > CFG.cupClickGapMs) {
                    var want = getWantedSize(say);
                    if (want) {
                        var z = getZones();
                        var b = document.getElementById('q3_' + want) ||
                                (z ? z.querySelector('[data-a="size:' + want + '"]') : null);
                        if (b) { triggerFullClick(b); st.lastCupClick = now; trace('🥤 lấy ly ' + want); }
                    }
                }
                return;
            }

            // sai size thì đổ ly làm lại
            var onBoard = getCupSize();
            var wantSize = getWantedSize(say);
            if (wantSize && onBoard && onBoard !== wantSize) {
                releasePour();
                if (chkCup.checked && now - st.trashAt > 1500) {
                    var trash = document.getElementById('q3trash');
                    if (trash) { triggerFullClick(trash); st.trashAt = now; trace('🗑️ ly ' + onBoard + ' ≠ yêu cầu ' + wantSize + ' → đổ'); }
                }
                st.phase = 'cup';
                return;
            }

            // ---- 2. RÓT TRÀ ----
            var pct = getPourPct();
            if (pct === null) { releasePour(); return; }
            // đọc lại mục tiêu mỗi 500ms: lúc đầu gauge chưa có kích thước thì chưa lấy được vạch xanh
            if (st.target === null || now - st.targetAt > 500) {
                st.target = getPourTarget();
                st.targetAt = now;
            }

            // rót tới khi nào pct >= st.target (>= 82% theo CFG.pourMinPct) thì mới sang bước sau
            if (pct < st.target) {
                if (!chkPour.checked) { setPhase('top'); return; }
                st.phase = 'pour';

                // đo tốc độ để thả tay đúng vạch, không bơm quá
                if (st.lastPct !== null && now - st.lastPctAt > 30) {
                    st.rate = (pct - st.lastPct) / (now - st.lastPctAt);
                    st.lastPct = pct;
                    st.lastPctAt = now;
                } else if (st.lastPct === null) {
                    st.lastPct = pct; st.lastPctAt = now;
                }
                var predicted = pct + st.rate * (CFG.loopMs * 1.5);

                if (predicted >= st.target - 0.3) { releasePour(); return; }

                var jar = getWantedTeaBtn();
                if (!jar) {
                    if (now - st.phaseAt > 2500) { trace('⚠️ không tìm thấy hũ trà đúng yêu cầu'); st.phaseAt = now; }
                    return;
                }
                if (st.pressing === jar) {
                    if (now - st.lastPress > CFG.pressRepeatMs) { startPress(jar); st.lastPress = now; }
                } else {
                    releasePour();
                    startPress(jar);
                    st.pressing = jar;
                    st.lastPress = now;
                    trace('🫗 rót ' + (jar.getAttribute('aria-label') || jar.getAttribute('data-tea')) +
                          ' → mục tiêu ' + st.target.toFixed(1) + '%' +
                          (getAutoPourLine() !== null ? ' (vạch xanh ' + getAutoPourLine().toFixed(1) + '%, tối thiểu ' + CFG.pourMinPct + '%)' : ' (vạch xanh không đọc được, tối thiểu ' + CFG.pourMinPct + '%)'));
                }
                if (now - st.phaseAt > CFG.maxPourMs) {
                    releasePour();
                    trace('⚠️ rót quá ' + CFG.maxPourMs + 'ms, bỏ qua');
                    setPhase('top');
                }
                return;
            }

            releasePour();
            if (st.lastPhaseLog !== 'pour-ok') { trace('✅ rót xong ' + pct.toFixed(1) + '% (>= ' + st.target.toFixed(1) + '%)'); st.lastPhaseLog = 'pour-ok'; }
            setPhase('top');

            // ---- 3. TOPPING ----
            if (st.phase === 'top') {
                var top = getWantedTopBtn();
                if (!top || toppingSatisfied(top, st)) {
                    if (top) trace('🧋 topping "' + topName(top) + '" đã xong sau ' + st.topTries + ' lần bấm');
                    setPhase('seal');
                } else if (now - st.phaseAt > CFG.toppingMaxMs) {
                    trace('⚠️ topping không nhận được sau ' + CFG.toppingMaxMs + 'ms → bỏ qua');
                    setPhase('seal');
                } else if (st.topTries >= CFG.maxToppingTaps) {
                    trace('⚠️ đã bấm topping ' + CFG.maxToppingTaps + ' lần → bỏ qua');
                    setPhase('seal');
                } else if (now - st.lastTop > CFG.tapDelayMs) {
                    var pops = document.getElementById('q3pops');
                    if (st.topTries === 0) st.popsBefore = pops ? pops.childElementCount : -1;
                    // giữ ~140ms: chịu được cả handler bấm lẫn handler giữ
                    startPress(top);
                    setTimeout(function() { stopPress(top); }, CFG.toppingHoldMs);
                    st.lastTop = now;
                    st.topTries++;
                    trace('🧋 thêm topping: ' + topName(top) + ' (lần ' + st.topTries + '/' + CFG.maxToppingTaps + ')');
                }
                return;
            }

            // ---- 4. DÁN NẮP & GIAO LY ----
            if (st.phase === 'seal') {
                if (now - st.phaseAt < CFG.sealDelayMs) return;
                if (!chkSeal.checked) { st.phase = 'idle'; return; }
                var seal = document.getElementById('q3seal');
                if (seal) { triggerFullClick(seal); trace('✅ dán nắp & giao ly'); }
                st.phase = 'idle';
                return;
            }
        }

        setInterval(stepServe, CFG.loopMs);

        // ==========================================================
        // 🔍 CHẨN ĐOÁN
        // ==========================================================
        document.getElementById('btn-diag').addEventListener('click', function() {
            var L = [];
            L.push('===== CHẨN ĐOÁN v' + CFG.appVersion + ' =====');
            L.push('Cảnh báo: @name/@namespace phải cố định. Nếu đổi, Tampermonkey sẽ cài bản sao mới thay vì update.');
            L.push('body.class = "' + document.body.className + '"');
            L.push('#hMoney = ' + (document.getElementById('hMoney') ? document.getElementById('hMoney').innerText : '?'));
            L.push('#fore = ' + (document.querySelector('.fore') ? document.querySelector('.fore').innerText : '?'));
            var cook = getCookBtn();
            L.push('#cook = ' + (cook ? cook.outerHTML.replace(/\s+/g, ' ').slice(0, 160) : 'KHÔNG CÓ'));
            L.push('readCost=' + readCost() + ' blocked=' + isCookBlocked());

            L.push('--- CAROUSEL KHO ---');
            var swipe = getSwipe();
            L.push('swipe=' + (swipe ? '#' + swipe.id + ' w=' + Math.round(swipe.getBoundingClientRect().width) : '?'));
            L.push('tab data-si đang mở = ' + getActiveTabSi());
            var pages = document.querySelectorAll('.spage');
            var act = getActiveSpage();
            L.push('số .spage = ' + pages.length + ' | số .rowi.kho = ' + document.querySelectorAll('.rowi.kho').length);
            for (var i = 0; i < pages.length; i++) {
                var r = pages[i].getBoundingClientRect();
                L.push('  spage[' + i + '] left=' + Math.round(r.left) + ' w=' + Math.round(r.width) + (pages[i] === act ? '  <== ACTIVE' : ''));
            }
            L.push('--- Món trong page đang mở ---');
            getActiveRows().forEach(function(row) {
                var inf = getRowInfo(row);
                L.push('  ' + inf.name + ' | tồn=' + inf.stock + ' | giá=' + inf.price + 'k | KH=' + inf.plan + ' | raw="' + inf.raw + '"');
            });
            L.push('--- Món ngoài page (carousel đẩy) ---');
            Array.prototype.slice.call(document.querySelectorAll('.rowi.kho')).forEach(function(row) {
                if (act && act.contains(row)) return;
                var inf = getRowInfo(row);
                L.push('  ' + inf.name + ' | tồn=' + inf.stock + ' | raw="' + inf.raw + '"');
            });

            L.push('===== MÀN PHỤC VỤ =====');
            L.push('order = "' + getOrderText() + '"');
            L.push('phase = ' + SERVE.phase + ' | target = ' + SERVE.target);
            L.push('hasCup = ' + hasCup() + ' | sealed = ' + cupSealed() + ' | size trên ly = ' + getCupSize());
            L.push('gauge = ' + getPourPct() + '%');
            L.push('vạch xanh .q3ok = ' + (getAutoPourLine() === null ? 'KHÔNG ĐỌC ĐƯỢC' : getAutoPourLine().toFixed(2) + '%'));
            L.push('tối thiểu bắt buộc = ' + CFG.pourMinPct + '%');
            L.push('=> mục tiêu rót = ' + getPourTarget().toFixed(2) + '%  (dán nắp khi >= mức này)');
            var jar = getWantedTeaBtn();
            L.push('hũ trà game yêu cầu = ' + (jar ? jar.id + ' (' + jar.className + ')' : 'KHÔNG CÓ'));
            var top = getWantedTopBtn();
            L.push('topping game yêu cầu = ' + (top ? top.id + ' (' + top.className + ')' : 'KHÔNG CÓ'));
            L.push('#q3pops children = ' + (document.getElementById('q3pops') ? document.getElementById('q3pops').childElementCount : '?'));
            var lid = document.querySelector('#q3cup img.q3lid');
            L.push('#q3cup img.q3lid hidden = ' + (lid ? lid.hasAttribute('hidden') : '?'));
            L.push('gauge .q3ok offsetLeft = ' + (document.querySelector('.q3gauge .q3ok') ? document.querySelector('.q3gauge .q3ok').offsetLeft : '?') +
                   ' / gauge w = ' + (document.querySelector('.q3gauge') ? document.querySelector('.q3gauge').clientWidth : '?'));
            L.push('--- Tất cả .q3want trong #q3zones ---');
            var ws = document.querySelectorAll('#q3zones .q3want');
            for (var k = 0; k < ws.length; k++) L.push('  ' + ws[k].id + ' | ' + ws[k].className + ' | ' + (ws[k].getAttribute('data-a') || ws[k].getAttribute('data-tea') || ''));
            console.log(L.join('\n'));
        });

        console.log('✅ [TAMPERMONKEY] Auto Tiệm Trà v' + CFG.appVersion + ' đã kích hoạt!');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(initMod, 500);
    else window.addEventListener('DOMContentLoaded', initMod);
})();
