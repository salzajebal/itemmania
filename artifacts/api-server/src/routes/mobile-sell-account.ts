/** Account-only portion of the mobile sell registration screen. */
export function mobileSellAccountStyles(): string {
  return `<style>
  #im-mobile-sell-register .msa-only{display:none}
  #im-mobile-sell-register.is-account .msa-only{display:block}
  #im-mobile-sell-register.is-account .msr-type,
  #im-mobile-sell-register.is-account .msr-quantity,
  #im-mobile-sell-register.is-account .msr-meso-price{display:none}
  #im-mobile-sell-register .msr-section.msa-price{margin-top:41px}
  #im-mobile-sell-register .msa-price .msr-unit{border:0;padding-left:4px}
  .msa-next{width:calc(100% + 12px);height:72px;margin:52px 0 0 -6px;border:0;border-radius:15px;background:#1c9eef;color:#fff;font-size:22px;font-weight:750;box-shadow:0 2px 6px #128fc13b}
  .msa-next-message{margin:12px 0 0;font-size:14px;color:#22728d;line-height:1.45}
  .msa-next-message:empty{display:none}
  @media(max-width:390px){.msa-next{width:100%;margin-left:0}}
  </style>`;
}

export function mobileSellAccountMarkup(): string {
  return `<section class="msr-section msa-price msa-only" id="msa-form">
  <h2><label for="msa-price">판매금액을 입력해주세요.</label></h2>
  <div class="msr-input-wrap"><input id="msa-price" type="text" inputmode="numeric" pattern="[0-9,]*" autocomplete="off" placeholder="(1,000원 이상, 10원 단위 입력 가능)" aria-describedby="msa-price-error" data-testid="input-account-price"><span class="msr-unit">원</span></div>
  <p class="msr-validation" id="msa-price-error" role="alert"></p>
  <p class="msr-calculation">수수료 5% : <strong id="msa-fee" data-testid="text-account-fee">0원</strong><span class="msr-net">실 수령액 : <strong id="msa-net" data-testid="text-account-net">0원</strong></span></p>
  <ul class="msr-warnings"><li><span class="msr-check" aria-hidden="true">✓</span><span>평균 시세보다 현저히 낮은 금액으로 등록할 경우, 거래 상대자 피해 및 시세조작등의 사유로 상품등록이 제한될 수 있습니다.</span></li><li><span class="msr-check" aria-hidden="true">✓</span><span>연간 기준으로 4,800만원 이상 판매 시 과세 대상에 포함될 수 있습니다.</span></li></ul>
  <button type="button" class="msa-next" id="msa-next" data-testid="button-account-next">다음</button><p class="msa-next-message" id="msa-next-message" role="status" aria-live="polite"></p></section>`;
}

export function mobileSellAccountScript(): string {
  return `
  var accountPrice=document.getElementById('msa-price'),accountFee=document.getElementById('msa-fee'),accountNet=document.getElementById('msa-net');
  function accountUpdatePrice(){
    var raw=accountPrice.value.replace(/,/g,''),amount=Number(raw),valid=raw!==''&&Number.isSafeInteger(amount)&&amount>=1000&&amount%10===0;
    document.getElementById('msa-price-error').textContent=raw&&!valid?'1,000원 이상, 10원 단위로 입력해 주세요.':'';
    accountPrice.setAttribute('aria-invalid',String(Boolean(raw&&!valid)));
    var charge=valid?Math.round(amount*.05):0;
    accountFee.textContent=charge.toLocaleString('ko-KR')+'원';
    accountNet.textContent=(valid?amount-charge:0).toLocaleString('ko-KR')+'원';
    return valid;
  }
  accountPrice.addEventListener('input',function(){
    var raw=accountPrice.value.replace(/[^0-9]/g,'');
    accountPrice.value=raw?Number(raw).toLocaleString('ko-KR'):'';
    accountUpdatePrice();
    document.getElementById('msa-next-message').textContent='';
  });
  document.getElementById('msa-next').addEventListener('click',function(){
    if(!accountUpdatePrice()){
      document.getElementById('msa-price-error').textContent='1,000원 이상, 10원 단위로 입력해 주세요.';
      accountPrice.focus();
      return;
    }
    var selectedOption=document.querySelector('#msr-servers [role="option"][aria-selected="true"]');
    var draft={category:'account',gameCode:params.get('search_game'),serverName:selectedOption?selectedOption.textContent.trim():'',price:Number(accountPrice.value.replace(/,/g,''))};
    var message=document.getElementById('msa-next-message');
    try{sessionStorage.setItem('mobile-sell-account-draft',JSON.stringify(draft))}catch(e){}
    message.textContent='';showRegistrationReview(draft);
  });
  try{
    var savedAccount=JSON.parse(sessionStorage.getItem('mobile-sell-account-draft')||'null');
    if(savedAccount&&savedAccount.gameCode===params.get('search_game')&&savedAccount.category==='account'&&Number.isSafeInteger(savedAccount.price)&&savedAccount.price>=1000){
      accountPrice.value=savedAccount.price.toLocaleString('ko-KR');
      accountUpdatePrice();
    }
  }catch(e){}
  `;
}