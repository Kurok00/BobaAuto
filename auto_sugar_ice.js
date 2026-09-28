(function() {
  var say = document.getElementById('q3say');
  if (!say) return;

  var text = say.textContent || '';

  var sugarPresses = 0;
  if (text.indexOf('100% đường') !== -1) sugarPresses = 4;
  else if (text.indexOf('70% đường') !== -1) sugarPresses = 3;
  else if (text.indexOf('50% đường') !== -1) sugarPresses = 2;
  else if (text.indexOf('30% đường') !== -1) sugarPresses = 1;

  var iceScoops = 0;
  if (text.indexOf('không đá') !== -1) iceScoops = 0;
  else if (text.indexOf('ít đá') !== -1) iceScoops = 1;
  else if (text.indexOf('đá bình thường') !== -1) iceScoops = 2;

  var sugarBtn = document.getElementById('q3b_sugar');
  var iceBtn = document.getElementById('q3b_ice');

  function clickBtn(btn, times, interval) {
    if (!btn || times <= 0) return;
    var count = 0;
    var timer = setInterval(function() {
      btn.click();
      count++;
      if (count >= times) clearInterval(timer);
    }, interval || 300);
  }

  clickBtn(sugarBtn, sugarPresses, 350);
  clickBtn(iceBtn, iceScoops, 350);
})();
