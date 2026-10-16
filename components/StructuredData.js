import {jsonLd} from '../lib/seo.mjs';
export default function StructuredData({data}){return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(data)}}/>;}
