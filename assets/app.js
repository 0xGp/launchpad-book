(function () {
  var btn = document.querySelector(".menu");
  if (btn) btn.addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("nav-open") && !e.target.closest(".sidebar") && !e.target.closest(".menu"))
      document.body.classList.remove("nav-open");
  });
  var f = document.querySelector(".filter");
  if (f) f.addEventListener("input", function () {
    var q = f.value.toLowerCase();
    document.querySelectorAll(".sidebar li").forEach(function (li) { li.style.display = li.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none"; });
  });
  document.querySelectorAll(".copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var code = b.closest(".code").querySelector("code").innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1200); }, function () { b.textContent = "Select & copy"; });
    });
  });
  var a = document.querySelector(".sidebar a.active"), sb = document.querySelector(".sidebar");
  if (a && sb) sb.scrollTop = Math.max(0, a.offsetTop - sb.clientHeight / 2);
})();
