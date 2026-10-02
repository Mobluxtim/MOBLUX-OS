import {PresentationPreview} from '../../../../../components/presentation-preview';
export default async function Page({params}:{params:Promise<{projectId:string;versionId:string;revisionId:string}>}){return <PresentationPreview {...await params}/>;}
