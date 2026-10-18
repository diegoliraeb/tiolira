export const BILLING_DOCUMENT_ERROR='CPF ou CNPJ inválido. Confira os números em Meus dados para gerar o pagamento.';
export function validBillingDocument(value){
 const digits=String(value??'').replace(/[.\/\-\s]/g,'');
 if(!/^(\d{11}|\d{14})$/.test(digits)||/^(\d)\1+$/.test(digits))return false;
 const numbers=[...digits].map(Number),base=digits.length-2;
 for(let length=base;length<digits.length;length++){
  let sum=0;
  for(let i=0;i<length;i++)sum+=numbers[i]*(digits.length===11?length+1-i:((length-1-i)%8)+2);
  const remainder=sum%11,check=remainder<2?0:11-remainder;
  if(numbers[length]!==check)return false;
 }
 return true;
}
