function loadGA4() {
  window.dataLayer = window.dataLayer || []
  function gtag() { dataLayer.push(arguments) }
  gtag('js', new Date())
  gtag('config', 'G-BT3L97QKS5')

  var gaScript = document.createElement('script')
  gaScript.async = true
  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-BT3L97QKS5'
  document.head.appendChild(gaScript)
}

window.addEventListener('load', function () {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadGA4, { timeout: 10000 })
  } else {
    setTimeout(loadGA4, 5000)
  }
})
