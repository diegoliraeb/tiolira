// Approved covers replace only these original images. Later edits in Admin win.
const covers={
 presepio:['/assets/5e6af6dbc5364235.jpg','presepio','v4'],
 fe:['/assets/ccfd9e1621ccd1b2.jpg','pequenos-simbolos'],
 nordeste:['/assets/47f8da1039d82f07.jpg','raizes-nordestinas'],
 '91550bb8-ec5a-4ec8-866b-abfd9edf31d4':['/api/media?path=images%2F6d74fbb9-d11a-43a3-9729-b29874148f4d.png','folclore'],
 'b0ce9448-8843-4046-a19f-7c3648cc3982':['/api/media?path=images%2Fa2c5a9a0-b886-471c-9b06-302c9aa75b7a.png','guardioes-natal'],
 'de1d16c4-5306-4f91-8696-fa0d512a5dbf':['/api/media?path=images%2F6647c13d-0731-4f8c-a9b3-10ea54cfec5a.png','sagrada-familia']
};
export function collectionCover(collection){
 const approved=covers[collection.id];
 return approved&&collection.image===approved[0]?`/assets/collections/${approved[1]}-${approved[2]||'v3'}.webp`:collection.image;
}
