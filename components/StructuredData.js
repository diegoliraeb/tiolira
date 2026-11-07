import {jsonLd} from '../lib/seo.mjs';
import {headers} from 'next/headers';
export default async function StructuredData({data}){const nonce=(await headers()).get('x-tiolira-nonce');return <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{__html:jsonLd(data)}}/>;}
