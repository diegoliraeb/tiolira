import Admin from '../../components/Admin';
import seed from '../../data/catalog.json';
export const metadata={title:'Administração',robots:{index:false,follow:false}};
export default function Page(){return <Admin seed={seed}/>}
