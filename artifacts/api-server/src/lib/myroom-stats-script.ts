export const MYROOM_STATS_SCRIPT = `<script>
(function(){
  if(window._imMyroomStats||location.pathname.indexOf('/myroom/')!==0)return;
  window._imMyroomStats=true;
  var paths={'/myroom/sell/sell_pay_wait.html':'sellPending','/myroom/sell/sell_ing.html':'sellActive',
    '/myroom/buy/buy_pay_wait.html':'buyPending','/myroom/buy/buy_ing.html':'buyProcessing'};
  function apply(data){
    document.querySelectorAll('.nav a[href],.gnb_list a[href]').forEach(function(a){
      var path;try{path=new URL(a.href,location.href).pathname}catch(e){return}
      var key=paths[path],spans=a.querySelectorAll('span');
      if(key&&spans.length>1)spans[spans.length-1].textContent=data?String(data[key]||0):'—';
    });
  }
  function refresh(){
    if(document.hidden||!document.querySelector('.nav,.gnb_list'))return;
    fetch('/api/products/my/stats',{credentials:'include',cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('stats');return r.json()}).then(apply)
      .catch(function(){apply(null)});
  }
  function start(){refresh();setInterval(refresh,5000);window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
</script>`;
