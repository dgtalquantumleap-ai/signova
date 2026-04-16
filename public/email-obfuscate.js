document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.email-obfuscated').forEach(function (el) {
    var user = el.getAttribute('data-user')
    var domain = el.getAttribute('data-domain')
    if (user && domain) {
      el.textContent = user + '@' + domain
    }
  })
})
