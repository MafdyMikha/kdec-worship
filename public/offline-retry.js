const retry=document.getElementById('retry')
const connection=document.getElementById('connection-state')
const showConnection=()=>{connection.textContent=navigator.onLine?'Connection detected. Tap Try again. · عاد الاتصال، اضغط إعادة المحاولة.':'Waiting for a connection. · في انتظار الاتصال.'}
window.addEventListener('online',showConnection)
window.addEventListener('offline',showConnection)
showConnection()
retry.addEventListener('click',()=>{
  retry.disabled=true
  retry.textContent='Reconnecting… · جارٍ الاتصال…'
  location.reload()
})
