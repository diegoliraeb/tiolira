// File identifiers stay stable when a profile is renamed or its file is replaced.
export const MAX_PRINT_PROFILES=20;
const modelPath=/^models\/[a-zA-Z0-9._-]+\.(3mf|stl|zip|pdf)$/i;
export function productFiles(product){
 const files=[];
 if(modelPath.test(product.filePath||''))files.push({id:'original',name:product.fileProfile?.name||'Perfil original',layerHeight:product.fileProfile?.layerHeight??null,notes:product.fileProfile?.notes||'',filePath:product.filePath});
 for(const profile of product.printProfiles||[])if(profile.id!=='original'&&modelPath.test(profile.filePath||''))files.push(profile);
 return files;
}
export const hasProductFiles=product=>productFiles(product).length>0;
export function publicPrintProfiles(product,canDownload=false){
 return productFiles(product).map(({id,name,layerHeight,notes,filePath})=>({id,name,layerHeight:layerHeight??null,notes:notes||'',format:filePath.split('.').pop().toUpperCase(),...(canDownload?{downloadUrl:`/api/download?id=${encodeURIComponent(product.id)}&profile=${encodeURIComponent(id)}`}:{})}));
}
export function resolveProductFile(product,profileId){
 const files=productFiles(product);
 // An invalid or removed identifier never silently downloads a different file.
 return profileId===null||profileId===undefined?files[0]:files.find(file=>file.id===profileId);
}
