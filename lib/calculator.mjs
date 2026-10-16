export const defaults={quantity:1,grams:85,waste:8,hours:4.5,kgPrice:95,watts:120,kwhPrice:0.95,printerPrice:2200,lifetime:5000,maintenance:240,annualHours:2000,failure:10,post:0,laborHours:0.33,hourlyRate:25,packaging:2.5,freight:0,fees:6,margin:35};
export function calculate(v){
 for(const key of Object.keys(defaults))if(!Number.isFinite(v[key])||v[key]<0)throw Error('invalid');
 if(!Number.isInteger(v.quantity)||v.quantity<1||v.lifetime<=0||v.annualHours<=0||v.failure>=100||v.fees+v.margin>=100)throw Error('invalid');
 const material=v.grams/1000*v.kgPrice*(1+v.waste/100),energy=v.hours*v.watts/1000*v.kwhPrice,machine=v.hours*(v.printerPrice/v.lifetime+v.maintenance/v.annualHours);
 const print=(material+energy+machine)/(1-v.failure/100),extras=v.post+v.laborHours*v.hourlyRate+v.packaging+v.freight,cost=print+extras,price=cost/(1-(v.fees+v.margin)/100),fees=price*v.fees/100,profit=price-cost-fees;
 return {material,energy,machine,risk:print-material-energy-machine,extras,cost,price,fees,profit,total:price*v.quantity};
}

// Partner worksheet uses the same pricing engine as the existing public calculator.
export const artworkDefaults={grams:100,hours:6,minutes:12,packaging:3,kgPrice:100,labor:30,energy:1,watts:120,machine:0.6,failure:5,extras:0,fileCost:0,overhead:0,shipping:0,fee:5,margin:40};
export const workshopKeys=['kgPrice','labor','energy','watts','machine','failure'];
export function calculateArtwork(v){
 for(const key of Object.keys(artworkDefaults))if(!Number.isFinite(v[key])||v[key]<0||v[key]>1_000_000)throw Error('invalid');
 const r=calculate({...defaults,grams:v.grams,waste:0,hours:v.hours,kgPrice:v.kgPrice,watts:v.watts,kwhPrice:v.energy,printerPrice:0,lifetime:1,maintenance:v.machine,annualHours:1,failure:v.failure,post:v.extras+v.fileCost+v.overhead,laborHours:v.minutes/60,hourlyRate:v.labor,packaging:v.packaging,freight:v.shipping,fees:v.fee,margin:v.margin});
 if(!Number.isFinite(r.price)||r.price*100>Number.MAX_SAFE_INTEGER)throw Error('invalid');
 const price=r.price>0?Math.max(90,Math.ceil((r.price*100-90-1e-7)/100)*100+90)/100:0;
 return {...r,basePrice:r.price,price,fees:price*v.fee/100,profit:price*(1-v.fee/100)-r.cost,breakEven:r.cost/(1-v.fee/100),labor:v.minutes/60*v.labor,extras:v.packaging+v.extras+v.fileCost+v.overhead+v.shipping,printing:r.energy+r.machine,total:price};
}
export function artworkOffer(v,price){if(!Number.isFinite(price)||price<0||price>1_000_000)throw Error('invalid');const r=calculateArtwork(v);return {profit:price*(1-v.fee/100)-r.cost,status:price<r.breakEven?'loss':price<r.basePrice?'below':'met'};}
