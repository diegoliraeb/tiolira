export function canAdvertiseLicense(license,now=Date.now()){
 return Boolean(license?.code&&(!license.status||license.status==='active')&&(!license.validUntil||Date.parse(license.validUntil)>now));
}
export function licenseAnnouncementText(license){return `Licença comercial: ${license.code}`;}
