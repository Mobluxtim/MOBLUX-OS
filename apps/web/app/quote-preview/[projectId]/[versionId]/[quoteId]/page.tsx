import {QuotePreview} from '../../../../../components/quote-preview';
export default async function Page({params}:{params:Promise<{projectId:string;versionId:string;quoteId:string}>}){return <QuotePreview {...await params}/>;}
