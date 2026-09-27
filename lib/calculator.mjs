export const defaults={quantity:1,grams:85,waste:8,hours:4.5,kgPrice:95,watts:120,kwhPrice:0.95,printerPrice:2200,lifetime:5000,maintenance:240,annualHours:2000,failure:10,post:0,laborHours:0.33,hourlyRate:25,packaging:2.5,freight:0,fees:6,margin:35};
export function calculate(v){
 for(const key of Object.keys(defaults))if(!Number.isFinite(v[key])||v[key]<0)throw Error('invalid');
 if(!Number.isInteger(v.quantity)||v.quantity<1||v.lifetime<=0||v.annualHours<=0||v.failure>=100||v.fees+v.margin>=100)throw Error('invalid');
 const material=v.grams/1000*v.kgPrice*(1+v.waste/100),energy=v.hours*v.watts/1000*v.kwhPrice,machine=v.hours*(v.printerPrice/v.lifetime+v.maintenance/v.annualHours);
 const print=(material+energy+machine)/(1-v.failure/100),extras=v.post+v.laborHours*v.hourlyRate+v.packaging+v.freight,cost=print+extras,price=cost/(1-(v.fees+v.margin)/100),fees=price*v.fees/100,profit=price-cost-fees;
 return {material,energy,machine,risk:print-material-energy-machine,extras,cost,price,fees,profit,total:price*v.quantity};
}
