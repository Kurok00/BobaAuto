// ==UserScript==
// @name         Auto Tiem Tra Nho
// @namespace    http://tampermonkey.net/
// @version      20260928000006  ← BUMP mỗi lần commit để Tampermonkey nhận bản mới
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
        appVersion: '35.1',

        // ---------- kho ----------
        fallbackBudget: 50,
        clickDelay: 40,
        tabDelay: 320,
        maxReduceRounds: 60,
        cupsPerCustomer: 1,
        toppingPerCustomer: 0.5,
        restockBuffer: 12,       // dự phòng cố định
        restockBufferPerDay: 2,  // cộng thêm 2 phần cho MỖI ngày đã qua (nhu cầu tăng dần)
        maxAddClicksPerRow: 10,

        // ---------- phục vụ ----------
        loopMs: 60,
        pourTargetPct: 'auto',   // 'auto' = đọc vạch xanh .q3ok
        pourMinPct: 83,          // CHỈ dán nắp khi rót đạt tối thiểu mức này
        pourTargetFallback: 83,  // khi không đọc được .q3ok
        pressRepeatMs: 600,      // giữ nút rót, nhắc lại mỗi 600ms
        maxPourMs: 8000,         // rót quá lâu thì bỏ qua (chống kẹt)
        topSettleMs: 600,        // chờ game "xong rót" trước khi bấm topping lần đầu
        tapDelayMs: 700,         // giữa 2 lần bấm topping
        maxToppingTaps: 4,       // tối đa bấm topping mấy lần, tránh dư
        toppingMaxMs: 4000,      // topping thêm mãi không được thì bỏ qua
        sealDelayMs: 500,        // chờ trước khi dán nắp
        maxSealTries: 5,         // thử 5 kiểu bấm dán nắp trước khi quay lại làm topping
        stuckMs: 20000,          // bước nào đứng quá lâu thì coi là kẹt, đổ ly làm lại
        maxRestarts: 4,          // liên tục đổ ly quá số lần thì dừng, báo lỗi
        traceRepeatLimit: 4,     // tránh log spam khi máy trạng thái lặp
        cupClickGapMs: 700,
        sugarRetryMs: 900,       // chờ #q3hint cập nhật (animation game ~420ms) rồi mới bấm lại
        sugarBudgetMs: 10000,     // tổng ngân sách bước đường & đá, kể cả khi quay lại từ dán nắp
        setPriceTargetK: 25,       // giá mặc định mỗi nguyên liệu (nghìn đồng) khi bấm "Đặt giá"
        optimizeEnabled: false,    // bật tối ưu giá tự động mỗi ngày
        optimizeDayLast: 0,        // ngày cuối đã ghi nhận (0 = chưa bao giờ)
        optimizeMoneyAtDayStart: 0, // #hMoney tại đầu ngày (để tính lợi nhuận)
        optimizeProfitPrev: undefined, // lợi nhuận ngày trước (để so sánh)
        priceStep: 1000,           // bước điều chỉnh mỗi lần (VND/nguyên liệu)
        priceMin: 5000,            // giá tối thiểu mỗi nguyên liệu
        priceCapSafety: 0.8,       // giá ly tối đa = priceCap * 0.8 = 96k
        tampermonkeyVersion: '20260928000006', // @version hiện tại (bump cùng @version header)
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
        headerEl.innerHTML = '<span>🧋 Auto Tiệm Trà v' + CFG.appVersion + ' <small id="mod-version" style="opacity:0.6">@' + CFG.tampermonkeyVersion + '</small></span> <button id="mod-check-ver" style="background:#2980b9; color:white; border:none; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:11px;">🔄</button><button id="mod-close-btn" style="background:none; border:none; color:white; font-weight:bold; cursor:pointer; font-size:14px;">✕</button>';
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
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autofill" checked><b>2. Rót đúng trà (≥ ' + CFG.pourMinPct + '% mới sang bước sau)</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autotop" checked><b>3. Thêm topping khách gọi (làm trước khi rót)</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autosugar" checked><b>4. Đường &amp; đá (bấm đúng số lần)</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autoseal" checked><b>5. Dán nắp &amp; giao ly</b></label></div>' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-autodecl" checked><b>6. Từ chối đơn hết món (bấm "mời về")</b></label></div>' +
            '<hr style="border:0; border-top:1px solid #34495e; margin:4px 0;">' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-trace"><b>Trace log (tắt khi ổn)</b></label></div>' +
            '<hr style="border:0; border-top:1px solid #e67e22; margin:4px 0;">' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-setprice"><b>⚡ Đặt giá bán (thử nghiệm)</b></label></div>' +
            '<div id="row-setprice" style="display:none; ' + row + '"><input type="number" id="inp-price-k" value="25" min="1" max="100" step="1" style="width:60px; padding:2px; text-align:center;"><span>k/mục</span> <button id="btn-setprice" style="background:#e67e22; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Áp dụng</button></div>' +
            '<div id="log-setprice" style="font-size:11px; color:#2ecc71; margin-top:2px;"></div>' +
            '<hr style="border:0; border-top:1px solid #27ae60; margin:4px 0;">' +
            '<div style="' + row + '"><label style="' + lbl + '"><input type="checkbox" id="chk-optimize"><b>⚡ Tối ưu giá mỗi ngày</b></label></div>' +
            '<div id="log-optimize" style="font-size:11px; color:#2ecc71; margin-top:2px;"></div>' +
            '<div id="mod-update-status" style="font-size:11px; color:#2ecc71; margin-top:4px; text-align:center; padding:4px 0; border-top:1px solid #27ae60;">✅ Đã biết bản @' + CFG.tampermonkeyVersion + '</div>';
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

        // ---------------- đặt giá bán (thử nghiệm) ----------------
        var chkSetPrice = document.getElementById('chk-setprice');
        var inpPriceK = document.getElementById('inp-price-k');
        var rowSetPrice = document.getElementById('row-setprice');
        var logSetPrice = document.getElementById('log-setprice');
        chkSetPrice.addEventListener('change', function() { rowSetPrice.style.display = chkSetPrice.checked ? 'flex' : 'none'; });
        var chkOptimize = document.getElementById('chk-optimize');
        chkOptimize.addEventListener('change', function() {
            CFG.optimizeEnabled = chkOptimize.checked;
            CFG.optimizeDayLast = 0;
            CFG.optimizeProfitPrev = undefined;
            trace(chkOptimize.checked ? '⚡ Tối ưu giá BẬT — mỗi ngày sẽ tự điều chỉnh' : '⚡ Tối ưu giá TẮT');
        });
        document.getElementById('mod-check-ver').addEventListener('click', checkUpdate);

        // kiểm tra bản mới từ GitHub
        function checkUpdate() {
            var statusEl = document.getElementById('mod-update-status');
            if (!statusEl) return;
            statusEl.textContent = '⏳ Đang kiểm tra...';
            var script = document.createElement('script');
            script.textContent = '(function(){fetch("https://raw.githubusercontent.com/Kurok00/BobaAuto/main/boba-auto.user.js").then(function(r){return r.text()}).then(function(t){var m=t.match(/@version\s+(\d+)/);var e=document.getElementById("__boba_remote_version");if(e)e.textContent=m?m[1]:"";}).catch(function(){var e=document.getElementById("__boba_remote_version");if(e)e.textContent="ERR";})})();';
            document.body.appendChild(script);
            script.remove();
            var poll = setInterval(function() {
                var el = document.getElementById('__boba_remote_version');
                if (!el) return;
                var rv = el.textContent.trim();
                if (!rv || rv === 'ERR') { clearInterval(poll); if (statusEl) statusEl.textContent = '⚠️ Không kết nối được'; return; }
                clearInterval(poll);
                var lv = CFG.tampermonkeyVersion;
                if (rv > lv) { if (statusEl) statusEl.textContent = '⚡ CẬP NHẬT! Remote ' + rv + ' > Local ' + lv; }
                else { if (statusEl) statusEl.textContent = '✅ MỚI NHẤT (v' + rv + ')'; }
            }, 500);
        }

        function applySetPrice(targetK) {
            var targetVND = Math.round(Math.max(1, +targetK || CFG.setPriceTargetK) * 1000);
            var code = [
                '(function() {',
                '  var t=' + targetVND + ';',
                '  var c=Object.keys(S.sell||{});',
                '  var n=0;',
                '  c.forEach(function(k){',
                '    var cap=k==="L"?(CFG.sizeCap||50000):(CFG.itemCap*2||100000);',
                '    var v=Math.min(t,cap);',
                '    if(v>0){S.sell[k]=v;n++}',
                '  });',
                '  save();',
                '  var inps=document.querySelectorAll("input[data-g=sell]");',
                '  inps.forEach(function(i){var k=i.dataset.k,v=S.sell[k];if(v!==undefined)i.value=v/1000});',
                '  if(typeof paneGia==="function")paneGia();',
                '  console.log("[BobaAuto] ✅ Đặt giá: "+n+"/"+c.length+" nguyên liệu = "+t+"k/mục");',
                '  var lg=document.getElementById("log-setprice");',
                '  if(lg)lg.textContent="✅ Đặt '+targetK+'k cho "+n+" nguyên liệu";',
                '})();'
            ].join('\n');
            var script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            script.remove();
        }

        document.getElementById('btn-setprice').addEventListener('click', function() {
            var k = Math.max(1, Math.min(100, parseInt(inpPriceK.value) || CFG.setPriceTargetK));
            applySetPrice(k);
        });

        // điều chỉnh giá tất cả nguyên liệu ±step (uniform)
        function adjustPricesBy(step) {
            var maxAllowed = Math.round(CFG.priceCap * CFG.priceCapSafety);
            var code = [
                '(function() {',
                '  var step=' + step + ';',
                '  var maxAllowed=' + maxAllowed + ';',
                '  var priceMin=' + CFG.priceMin + ';',
                '  var c=Object.keys(S.sell||{});',
                '  var n=0;',
                '  c.forEach(function(k){',
                '    var cap=k==="L"?(CFG.sizeCap||50000):(CFG.itemCap*2||100000);',
                '    var v=Math.min(Math.max(S.sell[k]+step,priceMin),Math.min(cap,maxAllowed));',
                '    if(v>0){S.sell[k]=v;n++}',
                '  });',
                '  save();',
                '  var inps=document.querySelectorAll("input[data-g=sell]");',
                '  inps.forEach(function(i){var k=i.dataset.k,v=S.sell[k];if(v!==undefined)i.value=v/1000});',
                '  if(typeof paneGia==="function")paneGia();',
                '  console.log("[BobaAuto] ⚡ giá ' + (step>=0?'+':'') + step + 'đ → " + n + "/" + c.length + " nguyên liệu");',
                '})();'
            ].join('\n');
            var script = document.createElement('script');
            script.textContent = code;
            document.body.appendChild(script);
            script.remove();
        }

        // tối ưu giá mỗi ngày dựa trên lợi nhuận (#hMoney delta)
        function checkPriceOptimize() {
            if (!CFG.optimizeEnabled) return;
            var curDay = getGameDay();
            if (curDay === CFG.optimizeDayLast) return;
            var moneyNow = readBudget();
            if (moneyNow === null) { CFG.optimizeDayLast = curDay; return; }
            if (CFG.optimizeDayLast > 0) {
                var profitToday = moneyNow - CFG.optimizeMoneyAtDayStart;
                if (CFG.optimizeProfitPrev !== undefined && CFG.optimizeProfitPrev > 0) {
                    var pct = (profitToday - CFG.optimizeProfitPrev) / CFG.optimizeProfitPrev;
                    if (pct > 0.15) {
                        CFG.priceStep = Math.min(CFG.priceStep * 1.2, CFG.priceCap * 0.03);
                        adjustPricesBy(CFG.priceStep);
                        trace('⚡ giá ↑ +' + CFG.priceStep + 'đ (lợi nhuận +' + (pct*100).toFixed(0) + '%: ' + profitToday + 'k)');
                    } else if (pct < -0.15) {
                        CFG.priceStep = Math.max(CFG.priceStep * 0.8, 500);
                        adjustPricesBy(-CFG.priceStep);
                        trace('⚡ giá ↓ −' + CFG.priceStep + 'đ (lợi nhuận ' + (pct*100).toFixed(0) + '%: ' + profitToday + 'k)');
                    } else {
                        trace('⚡ giá giữ (lợi nhuận ' + (pct*100).toFixed(0) + '%: ' + profitToday + 'k)');
                    }
                    var lg = document.getElementById('log-optimize');
                    if (lg) lg.textContent = '⚡ ' + (pct > 0.15 ? '↑' : pct < -0.15 ? '↓' : '→') + ' LN ' + profitToday + 'k | bước ' + Math.round(CFG.priceStep) + 'đ';
                } else {
                    adjustPricesBy(CFG.priceStep);
                    trace('⚡ THỬ giá +' + CFG.priceStep + 'đ (điều chỉnh lần 1)');
                }
                CFG.optimizeProfitPrev = profitToday;
            }
            CFG.optimizeMoneyAtDayStart = moneyNow;
            CFG.optimizeDayLast = curDay;
        }

        // ---------------- sự kiện giả ----------------
        // pointerdown/pointerup phải là PointerEvent thật, nếu dùng MouseEvent
        // thì e.pointerId / e.isPrimary đều undefined và game có thể bỏ qua.
        function makeEvent(type, phase) {
            if (type.indexOf('touch') === 0) return new Event(type, { bubbles: true, cancelable: true });
            if (type.indexOf('pointer') === 0 && typeof PointerEvent === 'function') {
                return new PointerEvent(type, {
                    bubbles: true, cancelable: true, view: window,
                    pointerId: 1, isPrimary: true, pointerType: 'mouse',
                    button: 0, buttons: phase === 'down' ? 1 : 0,
                    clientX: 0, clientY: 0
                });
            }
            return new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 });
        }
        function fire(el, types, phase) {
            if (!el || el.isConnected === false) return;
            for (var i = 0; i < types.length; i++) {
                try { el.dispatchEvent(makeEvent(types[i], phase || 'down')); } catch (e) {}
            }
        }
        function triggerFullClick(el) {
            fire(el, ['pointerdown', 'mousedown'], 'down');
            fire(el, ['pointerup', 'mouseup', 'click', 'touchstart', 'touchend'], 'up');
        }
        function startPress(el) { fire(el, ['pointerdown', 'mousedown', 'touchstart'], 'down'); }
        function stopPress(el) { fire(el, ['pointerup', 'mouseup', 'touchend', 'click'], 'up'); }

        function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

        function trace() {
            if (!document.getElementById('chk-trace').checked) return;
            console.log.apply(console, ['[BobaAuto]'].concat(Array.prototype.slice.call(arguments)));
        }

        // ==========================================================
        // 💰 ĐỌC TIỀN — chuẩn hoá về "k" (nghìn)
        // ==========================================================
        // game dùng kiểu Việt: "1.032k" = 1032k, "1.852,5k" = 1852.5k (CHẤM = gom nghìn, PHẨY = thập phân)
        function parseViNumber(txt) {
            var t = String(txt).replace(/[\s\u00a0]/g, '');
            if (!t) return NaN;
            // "1.852,5" / "1,032" / "1.032" -> phần nguyên gom nghìn + phần thập phân (nếu có)
            var m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:([.,])(\d+))?$/);
            if (m) {
                var whole = parseInt(m[1].replace(/[.,]/g, ''), 10);
                return m[2] ? whole + '.' + m[3] : whole;
            }
            // "4,5" -> 4.5 | "77.5" -> 77.5 | "5" -> 5
            return parseFloat(t.replace(',', '.'));
        }

        function toK(str) {
            if (str === null || str === undefined) return null;
            var s = String(str).replace(/[\s\u00a0]/g, '').toLowerCase();
            if (!s) return null;
            var m = s.match(/\d[\d.,]*/);
            if (!m) return null;
            var val = parseViNumber(m[0]);
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
            var raw = String(el.innerText || el.textContent || '').replace(/[\s\u00a0]/g, '');
            var v = toK(raw);
            if (v === null || v <= 0) return null;
            // "1.032k" phải ra 1032, "1.852,5k" phải ra 1852.5 — cảnh báo nếu vẫn ra số nhỏ
            if (/\d[.,]\d{3}/.test(raw) && v < 100) {
                console.warn('[BobaAuto] ⚠️ Đọc ngân sách SAI: "' + raw + '" -> ' + v + 'k. Đáng ra ' +
                    parseViNumber(raw) + 'k. Bỏ qua trần ngân sách cho an toàn.');
                return null;
            }
            return v;
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

        // nút NẤU thường KHÔNG chứa số -> cộng từ các dòng ".sub.okline" (vd "+12 · 45k")
        function readCostFromPlans() {
            var els = document.querySelectorAll('.sub.okline');
            var total = 0, found = false;
            for (var i = 0; i < els.length; i++) {
                var e = els[i];
                if (e.hasAttribute('hidden') || e.style.display === 'none') continue;
                var t = String(e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim();
                var m = t.match(/(\d+(?:[.,]\d+)?)\s*k/i);
                if (m) { total += toK(m[1] + 'k') || 0; found = true; }
            }
            return found ? total : null;
        }

        function readCost() {
            var b = getCookBtn();
            if (b) {
                var attr = b.getAttribute && (b.getAttribute('data-cost') || b.getAttribute('data-money'));
                if (attr) { var a = toK(attr); if (a !== null && a > 0) return a; }
                var v = toK(b.innerText || b.textContent || '');
                if (v !== null && v > 0) return v;
            }
            return readCostFromPlans();
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

        // "Ngày" hiển thị trên đầu game: 3 = ngày 3. -1 = không đọc được
        function getGameDay() {
            var el = document.getElementById('hDay');
            if (!el) return -1;
            var v = parseInt(String(el.textContent || '').replace(/[^\d]/g, ''), 10);
            return isFinite(v) ? v : -1;
        }
        // .life = hạn sử dụng còn lại: class "l3" + chữ "3 ngày"; "l0" + "♾" = không hết hạn
        // .warnline = SỐ LƯỢNG HẾT HẠN HÔM NAY (game vẽ kèm icon cảnh báo)
        function getLifeInfo(row) {
            var nm = row.querySelector('.nm');
            var life = nm ? nm.querySelector('.life') : null;
            var days = null, txt = '';
            if (life) {
                txt = String(life.textContent || '').replace(/\s+/g, ' ').trim();
                var m = /l(\d+)/.exec(life.getAttribute('class') || '') || /(\d+)\s*ngày/i.exec(txt);
                if (m) days = parseInt(m[1], 10);
                else if (/♾|∞|vô hạn/i.test(txt)) days = Infinity;
                else if (/l0\b/.test(life.getAttribute('class') || '')) days = Infinity;
            }
            var warn = row.querySelector('.sub .warnline');
            var expiring = 0;
            if (warn) {
                var wn = String(warn.textContent || '').match(/\d+(?:[.,]\d+)?/);
                if (wn) expiring = Math.round(parseViNumber(wn[0])) || 0;
            }
            return { days: days, text: txt, expiring: expiring };
        }

        function getRowInfo(row) {
            var nm = row.querySelector('.nm');
            var sub = row.querySelector('.sub:not(.okline)') || row.querySelector('.sub');
            var raw = sub ? String(sub.innerText || sub.textContent || '').replace(/\s+/g, ' ').trim() : '';
            var nums = raw.match(/\d+(?:[.,]\d+)?/g) || [];
            var inp = row.querySelector('input[data-plan]');
            var life = getLifeInfo(row);
            return {
                row: row,
                name: nm ? getNameText(nm) : '?',
                stock: nums.length ? Math.round(parseViNumber(nums[0])) || 0 : null,
                // ".sub" = "đang có · hôm qua dùng · giá vốn" -> giá vốn là số CUỐI
                price: nums.length > 1 ? toK(nums[nums.length - 1] + 'k') : null,
                usedYesterday: nums.length > 1 ? Math.round(parseViNumber(nums[1])) || 0 : 0,
                lifeDays: life.days,
                lifeText: life.text,
                expiring: life.expiring,
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
                else console.log('💰 Ví: ' + budget + 'k   (raw="' +
                    (document.getElementById('hMoney') ? String(document.getElementById('hMoney').innerText || '').replace(/\s+/g, ' ').trim() : '?') + '")');

                var foreEl = document.querySelector('.fore.big2') || document.querySelector('.fore');
                var customers = 20;
                if (foreEl) {
                    var mC = (foreEl.innerText || '').match(/\d+/);
                    if (mC) customers = Math.min(500, Math.max(1, parseInt(mC[0], 10)));
                }
                var demand = customers * CFG.cupsPerCustomer;
                // Dự phòng = 12 + 2 × ngày. Ngày 3 → 18, ngày 10 → 32.
                // Tổng kết ngày 3: 27 ly bán + 14 khách bỏ về = 41 người đến,
                // nhưng buffer cũ chỉ +5 nên hết ly sớm, mất ~550k doanh thu.
                var day = getGameDay();
                var buffer = CFG.restockBuffer + (day > 0 ? day * CFG.restockBufferPerDay : 0);
                console.log('👥 Khách: ~' + customers + ' → nhu cầu ' + demand + ' ly' +
                            ' | dự phòng = ' + CFG.restockBuffer + ' + ' + (day > 0 ? day : '?') +
                            '×' + CFG.restockBufferPerDay + ' = ' + buffer + ' (ngày ' + (day > 0 ? day : '?') + ')');

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
                await planTab('0', function(j) { return teaPlan[j] + buffer; }, budget, budgetKnown, 'Trà');
                console.log('   → Trà: ' + teaCount + ' món, tổng ' + teaSum + ' phần (+' + buffer + ' dự phòng).');

                var toppingNeed = Math.max(1, Math.round(demand * CFG.toppingPerCustomer));
                await planTab('1', function(j, n) { return Math.max(1, Math.round(toppingNeed / n)) + buffer; }, budget, budgetKnown, 'Topping');

                var cupNeed = Math.max(demand, teaSum);
                await planTab('2', function() { return cupNeed + buffer; }, budget, budgetKnown, 'Ly');
                console.log('   → Ly: cần ' + cupNeed + ' (+' + buffer + ' dự phòng).');

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
                console.log('🔥 ' + (fin.cost === null ? 'không đọc được chi phí' : fin.cost + 'k ≤ ' + budget + 'k') +
                            (fin.cost === null ? ' (ngân sách ' + budget + 'k, vẫn bấm)' : '') + ' → bấm NẤU.');
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
        var chkDecl = document.getElementById('chk-autodecl');

        function freshServe() {
            return {
                order: null, phase: 'cup', phaseAt: Date.now(),
                target: null, targetAt: 0, pressing: null, lastPress: 0,
                lastPct: null, lastPctAt: Date.now(), rate: 0,
                lastTop: 0, topTries: 0, popsBefore: -1, shapesBefore: -1,
                sealTries: 0, restarts: 0, declAt: 0,
                lastCupClick: 0, trashAt: 0, lastPhaseLog: '',
                spamGuard: {},
                sugarClicks: 0, iceClicks: 0, sugarTarget: 0, iceTarget: 0,
                 sugarAt: 0, sugarTries: 0, iceTries: 0,
                flavPressed: false, flavTries: 0
            };
        }
        var SERVE = freshServe();

        function getOrderText() {
            var el = document.getElementById('q3say');
            return el ? String(el.innerText || '').replace(/\s+/g, ' ').trim() : '';
        }
        function getZones() { return document.getElementById('q3zones'); }
        function selling() { return document.body.classList.contains('selling'); }

        // #q3cup LUÔN tồn tại. Thẻ nắp <img class="q3lid"> cũng luôn có trong DOM,
        // chỉ được game đặt thuộc tính "hidden" => KHÔNG được coi là có ly.
        // Tín hiệu "đang cầm ly" theo thứ tự đáng tin:
        //   1. ly có nước (thanh trà/đá trong #q3cup)
        //   2. ly có nhãn size M/L (game chỉ vẽ nhãn sau khi đã cầm ly)
        //   3. nắp đang hiện (ly đã dán nắp)
        //   4. #q3noCup bị ẩn (game thôi nhắc "chưa có ly")
        function cupSignal() {
            var cup = document.getElementById('q3cup');
            if (!cup) return 'no#q3cup';
            if (cup.hasAttribute('hidden') || cup.style.display === 'none') return '#q3cup hidden';
            if (!cup.getClientRects || !cup.getClientRects().length) return '#q3cup 0 rect';
            if (cup.querySelector('svg .q3liq, svg .q3tea, svg .q3ice, svg .q3fill')) return 'có nước trong ly';
            if (getCupSize() !== null) return 'nhãn size ' + getCupSize();
            var lid = cup.querySelector('img.q3lid');
            if (lid && !lid.hasAttribute('hidden') && lid.style.display !== 'none') return 'nắp đang hiện';
            var nc = document.getElementById('q3noCup');
            if (nc && (nc.hasAttribute('hidden') || nc.style.display === 'none')) return '#q3noCup đã ẩn';
            return 'trống (chưa cầm ly)';
        }
        function hasCup() {
            var cup = document.getElementById('q3cup');
            if (!cup) return false;
            if (cup.hasAttribute('hidden') || cup.style.display === 'none') return false;
            if (!cup.getClientRects || !cup.getClientRects().length) return false;
            if (cup.querySelector('svg .q3liq, svg .q3tea, svg .q3ice, svg .q3fill')) return true;
            if (getCupSize() !== null) return true;
            var lid = cup.querySelector('img.q3lid');
            if (lid && !lid.hasAttribute('hidden') && lid.style.display !== 'none') return true;
            var nc = document.getElementById('q3noCup');
            if (nc && (nc.hasAttribute('hidden') || nc.style.display === 'none')) return true;
            return false;
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
        function getSugarPresses(say) {
            if (/100%\s*đường/i.test(say)) return 4;
            if (/70%\s*đường/i.test(say)) return 3;
            if (/50%\s*đường/i.test(say)) return 2;
            if (/30%\s*đường/i.test(say)) return 1;
            return 0;
        }
        function getIceScoops(say) {
            if (/không\s*đá/i.test(say)) return 0;
            if (/ít\s*đá/i.test(say)) return 1;
            if (/đá\s*bình\s*thường/i.test(say)) return 2;
            return 0;
        }
        // ---- đọc TRẠNG THÁI THỰC TẾ của game (không tin vào click của mình) ----
        // #q3hint = "Đường 30% · ít đá" -> cập nhật ~420ms sau khi game NHẬN bấm đường/đá.
        // Nếu bấm mà hint không đổi = game đang bỏ qua click (tạm dừng / nhân viên phụ quầy
        // đang làm / máy đang dán nắp).
        function getHintText() {
            var h = document.getElementById('q3hint');
            return h ? String(h.textContent || '').replace(/\s+/g, ' ').trim() : '';
        }
        function hintSugarPresses(h) {
            var m = /(\d+)\s*%/.exec(h || '');
            if (!m) return 0;
            var p = +m[1];
            return p >= 100 ? 4 : p >= 70 ? 3 : p >= 50 ? 2 : p >= 30 ? 1 : 0;
        }
        function hintIceScoops(h) {
            if (/ít\s*đá/i.test(h || '')) return 1;
            if (/đá\s*bình\s*thường/i.test(h || '')) return 2;
            return 0;
        }
        // toast hiện đang hiển thị (game thường báo rõ lý do bỏ qua click)
        function getToastText() {
            var t = document.getElementById('toast');
            if (!t || !t.classList.contains('show')) return '';
            return String(t.textContent || '').replace(/\s+/g, ' ').trim();
        }
        // hộp thoại của game: Tạm dừng (đổi tab là game tự pause), level-up, hỏi đáp...
        function gameModal() {
            var m = document.getElementById('modal');
            return (m && !m.hasAttribute('hidden')) ? m : null;
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
        // mục tiêu rót = max(vạch xanh, pourMinPct) -> không bao giờ dán nắp dưới mức tối thiểu
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
        function norm(s) {
            return String(s || '').toLowerCase()
                .replace(/[àáảãạăằắẳẵặâầấẩẫậ]/g, 'a')
                .replace(/[èéẻẽẹêềếểễệ]/g, 'e')
                .replace(/[ìíỉĩị]/g, 'i')
                .replace(/[òóỏõọôồốổỗộơờớởỡợ]/g, 'o')
                .replace(/[ùúủũụưừứửữự]/g, 'u')
                .replace(/[ỳýỷỹỵ]/g, 'y')
                .replace(/đ/g, 'd')
                .replace(/\s+/g, ' ')
                .trim();
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
            // cuối cùng: khớp aria-label của hũ với text đơn hàng
            return matchByLabel(z, '.q3jar[data-tea]:not(.q3lock)', say, /^gi[uû]\s*đ[eê]\s*r[oó]t\s*/i);
        }
        // topping: ưu tiên .q3want, nếu không có thì khớp aria-label với text đơn hàng
        function getWantedTopBtn() {
            var z = getZones();
            if (!z) return null;
            var mark = z.querySelector('.q3z.q3want[data-a^="top:"]:not(.q3lock)');
            if (mark) return mark;
            return matchByLabel(z, '.q3z[data-a^="top:"]:not(.q3lock)', getOrderText(), null);
        }
        // flavor: game đánh dấu .q3want theo đơn (o.flav) -> ưu tiên mark
        function getWantedFlavBtn() {
            var z = getZones();
            if (!z) return null;
            var mark = z.querySelector('.q3z[data-a^="flav"]:not(.q3lock).q3want');
            if (mark) return mark;
            return matchByLabel(z, '.q3z[data-a^="flav"]:not(.q3lock)', getOrderText(), null);
        }
        // chọn nút có aria-label dài nhất mà text đơn hàng chứa nhiều nhất
        function matchByLabel(z, sel, say, stripRe) {
            var hay = norm(say);
            if (!hay) return null;
            var best = null, bestLen = 0;
            var btns = z.querySelectorAll(sel);
            for (var i = 0; i < btns.length; i++) {
                var raw = btns[i].getAttribute('aria-label') || '';
                if (stripRe) raw = raw.replace(stripRe, ' ');
                var lbl = norm(raw);
                if (lbl.length < 4) continue;
                if (hay.indexOf(lbl) === -1) continue;
                if (lbl.length > bestLen) { bestLen = lbl.length; best = btns[i]; }
            }
            return best;
        }
        // số hình vẽ trong ly (nước + topping) - dùng để xác nhận topping đã vào ly
        function cupShapeCount() {
            var cup = document.getElementById('q3cup');
            if (!cup) return -1;
            var gs = cup.querySelectorAll('svg g[clip-path]'), n = 0;
            for (var i = 0; i < gs.length; i++) n += gs[i].childElementCount;
            return n;
        }
        function topName(btn) {
            return btn ? (btn.getAttribute('aria-label') || btn.id || '?') : '?';
        }
        // các kiểu phát event, thử lần lượt vì không biết game lắng nghe kiểu nào.
        // Lưu ý: phải TÁCH down/up — fire(..., 'up') áp cùng phase cho mọi event,
        // khiến pointerdown đi kèm buttons:0 nên game bỏ qua.
        function downUpClick(el) {
            fire(el, ['pointerdown', 'mousedown'], 'down');
            fire(el, ['pointerup', 'mouseup'], 'up');
            fire(el, ['click'], 'up');
        }
        var SEAL_STRATS = [
            { name: 'pointer+mouse+click+touch', run: function (el) { triggerFullClick(el); } },
            { name: 'el.click()',           run: function (el) { try { el.click(); } catch (e) { triggerFullClick(el); } } },
            { name: 'pointer down/up + click', run: function (el) { downUpClick(el); } },
            { name: 'mouse down/up + click',  run: function (el) { fire(el, ['mousedown'], 'down'); fire(el, ['mouseup'], 'up'); fire(el, ['click'], 'up'); } },
            { name: 'giữ 150ms',           run: function (el) { startPress(el); setTimeout(function () { stopPress(el); }, 150); } }
        ];
        // thêm topping = BẤM (click), KHÔNG đè/giữ. Đè sẽ không ăn, hoặc dồn nhiều lớp.
        var TOP_TOPPING_WAYS = [
            { name: 'pointer+mouse+click', run: function (el) { triggerFullClick(el); } },
            { name: 'click() thuần',         run: function (el) { try { el.click(); } catch (e) { triggerFullClick(el); } } }
        ];

        // game tự nói đang chờ bước nào - quan trọng nhất để biết vì sao bấm không ăn
        function getCoachHint() {
            var c = document.getElementById('q3coach');
            if (!c) return null;
            var t = String(c.textContent || '').replace(/\s+/g, ' ').trim();
            if (!t) return null;
            return (c.hasAttribute('hidden') || c.style.display === 'none') ? 'ẩn: ' + t : t;
        }
        // kiên nhẫn của khách đang phục vụ (%)
        function getPatience() {
            var bar = document.querySelector('.q3bar > i');
            if (!bar) return '?';
            var w = parseFloat(bar.style.width || '0');
            return isFinite(w) ? w.toFixed(0) + '%' : '?';
        }
        function toppingSatisfied(top, st) {
            if (!top) return true;
            if (top.hasAttribute('hidden') || top.style.display === 'none') return true;
            if (/q3on|q3done|q3used|q3had/.test(top.className)) return true;
            var pops = document.getElementById('q3pops');
            if (pops && st.popsBefore >= 0 && pops.childElementCount > st.popsBefore) return true;
            if (st.shapesBefore >= 0 && cupShapeCount() > st.shapesBefore) return true;
            return false;
        }

        function releasePour() {
            if (SERVE.pressing) { stopPress(SERVE.pressing); SERVE.pressing = null; }
        }
        function setPhase(p, note) {
            if (SERVE.phase === p) return;
            SERVE.phase = p;
            SERVE.phaseAt = Date.now();
            traceOnce('phase:' + p, '→ ' + p + (note ? ' (' + note + ')' : ''));
        }
        // chống log spam: cùng 1 thông điệp chỉ in tối đa traceRepeatLimit lần
        function traceOnce(key, msg) {
            var g = SERVE.spamGuard;
            g[key] = (g[key] || 0) + 1;
            if (g[key] > CFG.traceRepeatLimit) {
                if (g[key] === CFG.traceRepeatLimit + 1) trace('⚠️ "' + msg + '" lặp quá nhiều, tắt log. Có thể game đang chặn thao tác này.');
                return;
            }
            trace(msg);
        }

        // bọc try/catch: một lỗi runtime trong 1 tick sẽ KHÔNG giết cả setInterval,
        // nếu không thì 1 dòng code hỏng làm script chết vĩnh viễn.
        function stepServe() {
            try { serveTick(); }
            catch (err) {
                releasePour();
                SERVE.crash = (SERVE.crash || 0) + 1;
                if (SERVE.crash <= CFG.traceRepeatLimit) {
                    console.error('[BobaAuto] ❌ lỗi ở bước "' + SERVE.phase + '": ' + (err && err.message ? err.message : err));
                }
            }
        }

        function serveTick() {
            checkPriceOptimize();
            if (!selling()) { releasePour(); return; }
            var now = Date.now();

            // ---- HỘP THOẠI GAME (Tạm dừng / level-up / hỏi đáp) ----
            // Đổi tab → game TỪ TẦM DỪNG → st.onclick BỎ MỌI click mà KHÔNG báo gì -> đường/đá bị "kẹt im".
            // KHÔNG tự bấm nút tiếp tục (người dùng tự xử lý) — chỉ đông đồng hồ để khỏi bị tính kẹt.
            var modal = gameModal();
            if (modal) {
                releasePour();
                SERVE.phaseAt = now;
                return;
            }

            // ---- WATCHDOG: bước đứng quá lâu thì tự thoát, không để treo vô hạn ----
            if (SERVE.phase !== 'cup' && SERVE.phase !== 'idle' && now - SERVE.phaseAt > CFG.stuckMs) {
                releasePour();
                SERVE.restarts = (SERVE.restarts || 0) + 1;
                trace('🚨 KẸT ở bước "' + SERVE.phase + '" quá ' + Math.round((now - SERVE.phaseAt) / 1000) + 's' +
                      ' (giữa chừng) — lần đổ ly thứ ' + SERVE.restarts +
                      '\n    order: "' + (SERVE.order || '?') + '" | ly: ' + cupSignal() +
                      '\n    game đang chờ: "' + (getCoachHint() || '?') + '" | kiên nhẫn: ' + getPatience() +
                      '\n    #q3hint = "' + getHintText() + '" | toast = "' + getToastText() + '"' +
                      '\n    hũ trà: ' + (getWantedTeaBtn() ? 'có' : 'KHÔNG CÓ') +
                      ' | nút topping: ' + (getWantedTopBtn() ? 'có' : 'KHÔNG CÓ'));
                if (SERVE.restarts >= CFG.maxRestarts) {
                    trace('🛑 ĐÃ ĐỔ LY ' + SERVE.restarts + ' LẦN LIÊN TIẾP → DỪNG phục vụ để khỏi đốt hàng.' +
                          '\n    Báo lại giúp tao dòng trên, kèm ảnh chụp màn hình lúc đang kẹt.');
                    SERVE.phase = 'idle';
                    SERVE.restarts = 0;
                    return;
                }
                var trw = document.getElementById('q3trash');
                if (trw) triggerFullClick(trw);
                SERVE.phase = 'cup';
                SERVE.phaseAt = now;
                SERVE.trashAt = now;
                SERVE.lastCupClick = 0;
                SERVE.target = null;
                SERVE.rate = 0;
                SERVE.lastPct = null;
                SERVE.lastPhaseLog = '';
                return;
            }
            var say = getOrderText();
            var st = SERVE;

            if (say !== st.order) {
                releasePour();
                st = SERVE = freshServe();
                st.order = say;
                if (say) trace('📝 order: "' + say + '"  (kiên nhẫn ' + getPatience() + ')');
            }

            // ---- 0. TỪ CHỐI ĐƠN HẾT MÓN ----
            // <button class="q3decl" data-decl="51">Hết món, mời về</button>
            // Khách đang đứng thì bấm để họ về ngay, thay vì đứng chờ hết kiên nhẫn
            // rồi bị tính là "khách bỏ về" — mất đánh giá và tip.
            var decl = document.querySelector('#q3say button.q3decl, #q3say [data-decl]');
            if (decl) {
                releasePour();
                if (chkDecl.checked && !decl.disabled && now - (st.declAt || 0) > 1500) {
                    st.declAt = now;
                    var dTxt = String(decl.innerText || decl.textContent || '').replace(/\s+/g, ' ').trim();
                    triggerFullClick(decl);
                    trace('🚪 bấm "' + (dTxt || 'Hết món, mời về') + '" → bỏ đơn này' +
                          ' | kiên nhẫn còn ' + getPatience() +
                          '\n    khách gọi: ' + String(say || '').replace(/\s*Hết món.*$/i, '').trim());
                }
                st.phase = 'idle';
                return;
            }
            st.declAt = 0;

            var idle = !say || /ngồi chơi|đang chờ khách|chờ khách|hết khách|quán đang vắng|hết món|mời về|đã về|cháu ngủ|ngủ ngon|đã đóng cửa|đóng cửa|nghỉ|is doing nốt đơn/i.test(say);
            if (idle) {
                releasePour();
                var p = getPourPct();
                // khách bỏ đi giữa chừng: ly đang rót dở phải đổ, không giữ lại
                if (p !== null && p > 1 && !cupSealed() && hasCup() && now - st.trashAt > 1500) {
                    var tr = document.getElementById('q3trash');
                    if (tr) { triggerFullClick(tr); st.trashAt = now; trace('🗑️ đổ ly sót (' + p.toFixed(1) + '%) — ' + (say || 'không có khách')); }
                }
                if (st.phase !== 'cup' && st.phase !== 'idle') {
                    trace('⏹️ ngừng: khách rời / quán vắng ("' + (say || '?') + '") — ly: ' + cupSignal());
                }
                st.phase = 'cup';
                st.lastPhaseLog = '';
                return;
            }

            // ---- 1. LẤY LY ----
            if (!hasCup()) {
                releasePour();
                if (st.phase !== 'cup') { traceOnce('cupLost', '🗑️ mất ly giữa chừng → lấy ly lại'); st.cupSince = now; }
                st.phase = 'cup';
                st.phaseAt = now;
                st.target = null;      // đọc lại vạch xanh cho ly mới
                st.rate = 0;
                st.lastPct = null;
                st.lastPhaseLog = '';
                // lấy ly mà mãi không được thì bỏ đơn này, đừng bấm vô tận
                if (!st.cupSince) st.cupSince = now;
                if (now - st.cupSince > CFG.stuckMs) {
                    trace('🛑 Không lấy được ly sau ' + Math.round((now - st.cupSince) / 1000) + 's' +
                          ' (bấm #q3_M/' + (getWantedSize(say) || '?') + ' không ăn) — bỏ qua đơn này.' +
                          '\n    ly: ' + cupSignal() + ' | game chờ: "' + (getCoachHint() || '?') + '"');
                    st.cupSince = 0;
                    st.phase = 'idle';
                    return;
                }
                if (chkCup.checked && now - st.lastCupClick > CFG.cupClickGapMs) {
                    var want = getWantedSize(say);
                    if (want) {
                        var z = getZones();
                        var b = document.getElementById('q3_' + want) ||
                                (z ? z.querySelector('[data-a="size:' + want + '"]') : null);
                        if (b) {
                            triggerFullClick(b);
                            st.lastCupClick = now;
                            trace('🥤 lấy ly ' + want + ' (bấm #' + b.id + ')');
                        } else {
                            traceOnce('noSizeBtn', '⚠️ không tìm thấy nút size ' + want + ' — ly: ' + cupSignal());
                        }
                    } else {
                        traceOnce('noSize', '⚠️ order không ghi rõ size M/L: "' + say + '"');
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

            // ---- 2. TOPPING (làm TRƯỚC khi rót) ----
            // Thứ tự đúng của game: lấy ly -> bỏ topping -> rót trà -> dán nắp.
            // Rót trước rồi topping sẽ không ăn, game cứ đứng chờ topping nên dán nắp vô ích.
            if (st.phase === 'cup') {
                st.phase = 'top';
                st.phaseAt = now;
                st.topTries = 0;
                st.lastTop = 0;
                var pb = document.getElementById('q3pops');
                st.popsBefore = pb ? pb.childElementCount : -1;
                st.shapesBefore = cupShapeCount();
                trace('   chuẩn bị bỏ topping: q3pops=' + st.popsBefore + ' hình trong ly=' + st.shapesBefore);
            }
            if (st.phase === 'top') {
                var top = getWantedTopBtn();
                var popsNow = document.getElementById('q3pops');
                var popsCnt = popsNow ? popsNow.childElementCount : -1;
                var shapeNow = cupShapeCount();
                if (!top) {
                    // đơn này không gọi topping -> sang rót luôn
                    setPhase('pour');
                    return;
                }
                if (!chkTop.checked) {
                    setPhase('pour');
                    return;
                }
                if (toppingSatisfied(top, st)) {
                    trace('🧋 topping "' + topName(top) + '" XONG sau ' + st.topTries + ' lần bấm' +
                          ' | pops ' + st.popsBefore + '→' + popsCnt + ' | hình trong ly ' + st.shapesBefore + '→' + shapeNow +
                          ' → chuyển sang rót');
                    setPhase('pour');
                } else if (now - st.phaseAt > CFG.toppingMaxMs) {
                    traceOnce('topTimeout', '⚠️ topping không nhận được sau ' + CFG.toppingMaxMs + 'ms\n' +
                           '    nút="' + topName(top) + '" class="' + top.className + '"' +
                           ' | pops ' + st.popsBefore + '→' + popsCnt + ' | hình ' + st.shapesBefore + '→' + shapeNow +
                           '\n    game đang chờ: "' + (getCoachHint() || '?') + '" → vẫn rót tiếp');
                    setPhase('pour');
                } else if (st.topTries >= CFG.maxToppingTaps) {
                    traceOnce('topMax', '⚠️ đã bấm topping ' + CFG.maxToppingTaps + ' lần mà ly không đổi' +
                           ' (pops ' + st.popsBefore + '→' + popsCnt + ', hình trong ly ' + st.shapesBefore + '→' + shapeNow + ')' +
                           ' | nút="' + topName(top) + '" class="' + top.className + '"\n' +
                           '    game đang chờ: "' + (getCoachHint() || '?') + '" → vẫn rót tiếp');
                    setPhase('pour');
                } else if (st.topTries === 0 && now - st.phaseAt < CFG.topSettleMs) {
                    // chờ game bật nút topping sau khi lấy ly
                    return;
                } else if (now - st.lastTop > CFG.tapDelayMs) {
                    // topping chỉ ăn click, tuyệt đối không đè (đè = trượt hoặc dồn lớp)
                    var way = (st.topTries % TOP_TOPPING_WAYS.length);
                    var wname = TOP_TOPPING_WAYS[way].name;
                    TOP_TOPPING_WAYS[way].run(top);
                    st.lastTop = now;
                    st.topTries++;
                    trace('🧋 thêm topping: "' + topName(top) + '" [' + top.getAttribute('data-a') +
                          '] lần ' + st.topTries + '/' + CFG.maxToppingTaps + ' bằng [' + wname + ']' +
                          ' | pops ' + st.popsBefore + ' hình ' + st.shapesBefore +
                          ' | game chờ: "' + (getCoachHint() || '?') + '"');
                }
                return;
            }

            // ---- 3. RÓT TRÀ (bước cuối, sau khi đã bỏ topping) ----
            var pct = getPourPct();
            if (pct === null) { releasePour(); return; }
            // đọc lại mục tiêu mỗi 500ms: lúc đầu gauge chưa có kích thước thì chưa lấy được vạch xanh
            if (st.target === null || now - st.targetAt > 500) {
                st.target = getPourTarget();
                st.targetAt = now;
            }

            // rót tới khi nào pct >= st.target (>= pourMinPct) thì mới sang bước dán nắp
            if (pct < st.target) {
                if (!chkPour.checked) { setPhase('seal'); return; }
                // mới vào bước rót thì reset đồng hồ 8s + tốc độ cũ
                if (st.phase !== 'pour') {
                    st.phase = 'pour';
                    st.phaseAt = now;
                    st.rate = 0;
                    st.lastPct = pct;
                    st.lastPctAt = now;
                    st.lastPress = 0;
                }

                // đo tốc độ để thả tay đúng vạch, không bơm quá
                if (st.lastPct !== null && now - st.lastPctAt > 30) {
                    st.rate = (pct - st.lastPct) / (now - st.lastPctAt);
                    st.lastPct = pct;
                    st.lastPctAt = now;
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
                    if (pct < 5) {
                        // gauge đứng 0% suốt 8s => ly không nhận được nước, ly này hỏng
                        traceOnce('pourDead', '⚠️ rót 8s mà gauge vẫn ' + pct.toFixed(1) + '% → đổ ly, lấy lại');
                        var trash2 = document.getElementById('q3trash');
                        if (trash2) triggerFullClick(trash2);
                        st.phase = 'cup';
                        st.phaseAt = now;
                        st.lastCupClick = 0;
                        st.trashAt = now;
                        return;
                    }
                    traceOnce('pourSlow', '⚠️ rót quá ' + CFG.maxPourMs + 'ms ở ' + pct.toFixed(1) + '% → dán nắp luôn');
                    setPhase('seal');
                }
                return;
            }

            releasePour();
            // rót đạt yêu cầu -> sang bước đường & đá
            if (st.phase === 'pour') {
                if (st.lastPhaseLog !== 'pour-ok') {
                    trace('✅ rót xong ' + pct.toFixed(1) + '% (>= ' + st.target.toFixed(1) + '%)' +
                          ' | hình trong ly=' + cupShapeCount() + ' | kiên nhẫn=' + getPatience() +
                          ' → chuyển sang đường & đá');
                    st.lastPhaseLog = 'pour-ok';
                }
                setPhase('sugar');
            }


            // ---- 4. ĐÁ & ĐƯỜNG ---- flow: ice -> sugar -> seal
            // Game CÓ THỂ BỎ QUA click của ta mà không báo lỗi:
            //  - đang Tạm dừng (đổi tab -> game tự pause, #modal hiện)  -> bỏ im lặng
            //  - nhân viên phụ quầy đang làm (toast "Nhân viên đang rót...")
            //  - máy đang dán nắp R.sealing (bỏ im lặng)
            // Nên KHÔNG đếm click mù: đọc TIẾN ĐỘ THỰC TẾ từ #q3hint
            // ("Đường 30% · ít đá"), chỉ bấm cho tới khi hint đúng mới qua bước sau.
            if (st.phase === 'sugar') {
                var chkSugar = document.getElementById('chk-autosugar');
                if (!chkSugar || !chkSugar.checked) { setPhase('seal'); return; }

                var sugarBtn = document.getElementById('q3b_sugar');
                var iceBtn = document.getElementById('q3b_ice');
                if (!sugarBtn || !iceBtn) { setPhase('seal'); return; }

                var tS = getSugarPresses(say), tI = getIceScoops(say);
                if (tS !== st.sugarTarget || tI !== st.iceTarget) {
                    st.sugarTarget = tS;
                    st.iceTarget = tI;
                    st.sugarClicks = 0;
                    st.iceClicks = 0;
                    st.lastPress = 0;
                    st.sugarTries = 0;
                    st.iceTries = 0;
                    st.sugarAt = now;
                trace('🧊 đường & đá: nước đường ' + tS + ' lần, xúc đá ' + tI + ' lần | đơn: "' + say + '"');
            }

            // ---- pha SỞ (vị) ---- đơn có vị thì bấm trước khi đường/đá
            var favBtn = getWantedFlavBtn();
            if (favBtn && !st.flavPressed) {
                if (now - st.lastPress > CFG.tapDelayMs) {
                    triggerFullClick(favBtn);
                    st.lastPress = now;
                    st.flavPressed = true;
                    st.flavTries++;
                    trace('🍓 bấm siro "' + topName(favBtn) + '"');
                }
                return;
            }

            var hint = getHintText();
            var doneS = hintSugarPresses(hint), doneI = hintIceScoops(hint);
            if (doneS !== st.sugarClicks || doneI !== st.iceClicks) {
                    st.sugarClicks = doneS;
                    st.iceClicks = doneI;
                    trace('🍬 game xác nhận: đường ' + doneS + '/' + tS + ' | đá ' + doneI + '/' + tI +
                          ' | hint="' + hint + '"');
                }

                if (st.sugarAt && now - st.sugarAt > CFG.sugarBudgetMs) {
                    traceOnce('sugarTimeout', '⚠️ đường & đá quá ' + Math.round(CFG.sugarBudgetMs / 1000) +
                              's (đã vào ly: đường ' + doneS + '/' + tS + ', đá ' + doneI + '/' + tI + ') -> dán nắp' +
                              ' | hint="' + hint + '" | toast="' + getToastText() + '"' +
                              ' | hộp thoại=' + (gameModal() ? 'CÓ' : 'không') +
                              ' | game chờ: "' + (getCoachHint() || '?') + '"');
                    setPhase('seal');
                    return;
                }

                if (st.iceClicks < tI) {
                    if (now - st.lastPress > CFG.sugarRetryMs) {
                        st.iceTries++;
                        triggerFullClick(iceBtn);
                        st.lastPress = now;
                        trace('🧊 xúc đá (thử ' + st.iceTries +
                                   ', đã vào ly ' + st.iceClicks + '/' + tI + ')');
                        if (st.iceTries > tI + 1) {
                            traceOnce('iceIgnored', '⚠️ game chưa nhận bấm đá sau ' + st.iceTries +
                                      ' lần thử | toast="' + getToastText() + '"' +
                                      ' | hộp thoại=' + (gameModal() ? 'CÓ' : 'không') +
                                      ' | hint="' + hint + '" | game chờ: "' + (getCoachHint() || '?') + '"');
                        }
                    }
                    return;
                }
                if (st.sugarClicks < tS) {
                    if (now - st.lastPress > CFG.sugarRetryMs) {
                        st.sugarTries++;
                        triggerFullClick(sugarBtn);
                        st.lastPress = now;
                        trace('🍬 bấm nước đường (thử ' + st.sugarTries +
                                   ', đã vào ly ' + st.sugarClicks + '/' + tS + ')');
                        if (st.sugarTries > tS + 1) {
                            traceOnce('sugarIgnored', '⚠️ game chưa nhận bấm đường sau ' + st.sugarTries +
                                      ' lần thử | toast="' + getToastText() + '"' +
                                      ' | hộp thoại=' + (gameModal() ? 'CÓ' : 'không') +
                                      ' | hint="' + hint + '" | game chờ: "' + (getCoachHint() || '?') + '"');
                        }
                    }
                    return;
                }
                trace('✅ đường & đá xong → dán nắp');
                setPhase('seal');
            }


            // ---- 5. DÁN NẮP & GIAO LY ----
            if (st.phase === 'seal') {
                if (cupSealed()) {
                    trace('✅ ly đã có nắp -> xong 1 ly');
                    st.phase = 'idle';
                    st.restarts = 0;
                    return;
                }
                // đơn hàng đổi rồi = đã giao cho khách mới, vòng reset sẽ xử lý
                if (getOrderText() !== st.order) { st.phase = 'idle'; return; }
                // chưa đủ đường/đá (theo #q3hint) mà đã lết sang dán nắp thì game sẽ
                // KHÔNG BAO GIỜ nhận nắp (ready() báo "Chưa chọn đường/đá") -> vô ích,
                // quay lại làm nốt. Chỉ trong ngân sách sugarBudgetMs, hết ngân sách thì
                // cứ dán để sealTries/d đổ ly xử lý (tránh lặp sugar<->seal vô tận).
                var chkS2 = document.getElementById('chk-autosugar');
                if (st.sugarAt && now - st.sugarAt <= CFG.sugarBudgetMs && chkS2 && chkS2.checked) {
                    var hBack = getHintText();
                    if (hintSugarPresses(hBack) < st.sugarTarget || hintIceScoops(hBack) < st.iceTarget) {
                        traceOnce('sealBackSugar', '↩ chưa đủ đường/đá (hint="' + hBack + '", cần đường ' +
                                  st.sugarTarget + ' / đá ' + st.iceTarget + ') → quay lại bước đường & đá');
                        setPhase('sugar');
                        return;
                    }
                }
                if (now - st.phaseAt < CFG.sealDelayMs) return;
                if (!chkSeal.checked) { st.phase = 'idle'; return; }
                if (st.sealTries >= CFG.maxSealTries) {
                    st.restarts = (st.restarts || 0) + 1;
                    traceOnce('sealFail', '⚠️ đã thử ' + CFG.maxSealTries + ' cách bấm dán nắp, ly vẫn chưa xong.\n' +
                           '    game đang chờ: "' + (getCoachHint() || '?') + '" | ly: ' + cupSignal() +
                           ' | #q3hint = "' + getHintText() + '" | toast = "' + getToastText() + '"' +
                           ' | hộp thoại = ' + (gameModal() ? 'CÓ' : 'không') +
                           ' | topping trong ly: ' + (st.shapesBefore >= 0 ? cupShapeCount() - st.shapesBefore : '?') + ' hình' +
                           ' | topping khách gọi: ' + (getWantedTopBtn() ? topName(getWantedTopBtn()) : 'KHÔNG CÓ') +
                           '\n    → đổ ly này (lần ' + st.restarts + '), KHÔNG bấm topping lại (tránh dồn 2 lớp)');
                    if (st.restarts >= CFG.maxRestarts) {
                        trace('🛑 ĐÃ ĐỔ LY ' + st.restarts + ' LẦN LIÊN TIẾP → DỪNG phục vụ để khỏi đốt hàng.');
                        st.phase = 'idle';
                        st.restarts = 0;
                        return;
                    }
                    var tr3 = document.getElementById('q3trash');
                    if (tr3) triggerFullClick(tr3);
                    st.trashAt = now;
                    st.phase = 'cup';
                    st.phaseAt = now;
                    st.lastCupClick = 0;
                    st.target = null;
                    st.rate = 0;
                    st.lastPct = null;
                    st.lastPhaseLog = '';
                    return;
                }
                var seal = document.getElementById('q3seal');
                if (!seal) { st.phase = 'idle'; return; }
                st.phaseAt = now;
                // thử lần lượt các kiểu phát event khác nhau, cách nào ăn thì cách đó được dùng lại.
                // sealTries bắt đầu từ 0 -> phải dùng chính nó làm chỉ số, trừ 1 sẽ ra -1
                // và SEAL_STRATS[-1] là undefined (gây crash, dừng cả vòng setInterval).
                var si = ((st.sealTries % SEAL_STRATS.length) + SEAL_STRATS.length) % SEAL_STRATS.length;
                var strat = SEAL_STRATS[si];
                if (!strat || !seal.isConnected) { st.phase = 'idle'; return; }
                strat.run(seal);
                st.sealTries++;
                traceOnce('sealTry', '🔒 dán nắp lần ' + st.sealTries + '/' + CFG.maxSealTries +
                          ' bằng [' + strat.name + ']' +
                          ' | nắp=' + cupSealed() + ' | kiên nhẫn=' + getPatience() +
                          ' | ly=' + cupSignal() +
                          ' | game chờ: "' + (getCoachHint() || '?') + '"');
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
            L.push('#hDay = ' + getGameDay() + ' | #hSub = "' +
                   (document.getElementById('hSub') ? document.getElementById('hSub').innerText : '?') + '"' +
                   ' | #open = ' + (document.getElementById('open') ? '"' + document.getElementById('open').innerText + '"' : 'KHÔNG CÓ'));
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
                L.push('  ' + inf.name + ' | tồn=' + inf.stock + ' | vốn=' + inf.price + 'k | dùng hôm qua=' + inf.usedYesterday +
                       ' | KH=' + inf.plan + ' | hạn=' + (inf.lifeDays === null ? '?' : (inf.lifeDays === Infinity ? '♾' : inf.lifeDays + ' ngày')) +
                       (inf.expiring > 0 ? ' | ⚠ HẾT HẠN HÔM NAY: ' + inf.expiring : '') +
                       ' | raw="' + inf.raw + '"');
            });
            L.push('--- Món ngoài page (carousel đẩy) ---');
            Array.prototype.slice.call(document.querySelectorAll('.rowi.kho')).forEach(function(row) {
                if (act && act.contains(row)) return;
                var inf = getRowInfo(row);
                L.push('  ' + inf.name + ' | tồn=' + inf.stock +
                       ' | hạn=' + (inf.lifeDays === null ? '?' : (inf.lifeDays === Infinity ? '♾' : inf.lifeDays + ' ngày')) +
                       (inf.expiring > 0 ? ' | ⚠ HẾT HẠN HÔM NAY: ' + inf.expiring : '') +
                       ' | raw="' + inf.raw + '"');
            });

            L.push('===== MÀN PHỤC VỤ =====');
            L.push('order = "' + getOrderText() + '"');
            L.push('phase = ' + SERVE.phase + ' | target = ' + SERVE.target);
            L.push('hasCup = ' + hasCup() + ' | sealed = ' + cupSealed() + ' | size trên ly = ' + getCupSize());
            L.push('TÍN HIỆU LY = ' + cupSignal());
            L.push('  -> có <img class="q3lid"> trong #q3cup: ' +
                   (document.querySelector('#q3cup img.q3lid') ? 'CÓ' : 'KHÔNG') +
                   (document.querySelector('#q3cup img.q3lid') ? ' | hidden=' + document.querySelector('#q3cup img.q3lid').hasAttribute('hidden') : ''));
            // liệt kê class bên trong #q3cup để biết chính xác "mực nước" dùng class gì
            var cupEl = document.getElementById('q3cup');
            if (cupEl) {
                var names = [];
                for (var ci = 0; ci < cupEl.querySelectorAll('*').length && ci < 200; ci++) {
                    var nd = cupEl.querySelectorAll('*')[ci];
                    var cn = (nd.getAttribute && nd.getAttribute('class')) || '';
                    if (cn) names.push(nd.tagName.toLowerCase() + '.' + cn.replace(/\s+/g, '.'));
                }
                L.push('--- class bên trong #q3cup ---');
                L.push('  ' + names.join('\n  '));
            }
            L.push('gauge = ' + getPourPct() + '%');
            L.push('vạch xanh .q3ok = ' + (getAutoPourLine() === null ? 'KHÔNG ĐỌC ĐƯỢC' : getAutoPourLine().toFixed(2) + '%'));
            L.push('tối thiểu bắt buộc = ' + CFG.pourMinPct + '%');
            L.push('=> mục tiêu rót = ' + getPourTarget().toFixed(2) + '%  (dán nắp khi >= mức này)');
            var jar = getWantedTeaBtn();
            L.push('hũ trà game yêu cầu = ' + (jar ? jar.id + ' (' + jar.className + ')' : 'KHÔNG CÓ'));
            var top = getWantedTopBtn();
            L.push('topping game yêu cầu = ' + (top ? top.id + ' (' + top.className + ')' : 'KHÔNG CÓ'));
            L.push('#q3pops children = ' + (document.getElementById('q3pops') ? document.getElementById('q3pops').childElementCount : '?'));
            L.push('hình vẽ trong ly = ' + cupShapeCount() + ' | kiên nhẫn khách = ' + getPatience());
            L.push('game đang chờ = "' + (getCoachHint() || '?') + '"');
            var dHint = getHintText();
            L.push('#q3hint = "' + dHint + '" -> đường theo hint = ' + hintSugarPresses(dHint) +
                   ', đá theo hint = ' + hintIceScoops(dHint));
            L.push('đường/đá cần (từ đơn) = ' + getSugarPresses(getOrderText()) + ' / ' + getIceScoops(getOrderText()));
            L.push('#toast = "' + getToastText() + '"');
            var dModal = gameModal();
            L.push('hộp thoại game = ' + (dModal ? 'CÓ: "' + String(dModal.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) + '"' : 'không'));
            ['q3seal', 'q3trash', 'q3_M', 'q3_L'].forEach(function (id) {
                var b = document.getElementById(id);
                L.push('  ' + id + ': ' + (b ? 'class="' + b.className + '"' : 'KHÔNG CÓ'));
            });
            var sEl = document.getElementById('q3seal');
            if (sEl) L.push('  #q3seal bị che? offsetParent=' + (sEl.offsetParent ? sEl.offsetParent.id || sEl.offsetParent.tagName : 'null') +
                            ' | style=' + sEl.getAttribute('style'));
            var declEl = document.querySelector('#q3say button.q3decl, #q3say [data-decl]');
            L.push('nút "Hết món, mời về" = ' + (declEl ? 'CÓ (chưa bấm)' : 'KHÔNG CÓ'));
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
