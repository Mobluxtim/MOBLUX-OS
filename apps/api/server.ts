import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { z, ZodError } from 'zod';
import { getConfig } from '../../packages/configuration/env.js';
import { authenticate, login, logout } from '../../packages/modules/identity/session.js';
import { authorize, DomainError } from '../../packages/modules/identity/policy.js';
import * as library from '../../packages/modules/catalog/service.js';
import * as resolution from '../../packages/modules/catalog/resolution.js';
import * as optimization from '../../packages/modules/projects/optimization.js';
import * as hardware from '../../packages/modules/projects/hardware.js';
import * as machining from '../../packages/modules/projects/machining.js';
import * as quotes from '../../packages/modules/quotes/service.js';
import * as portal from '../../packages/modules/portal/service.js';
import * as presentation from '../../packages/modules/presentations/service.js';
import {maxPresentationBytes} from '../../packages/modules/presentations/media.js';
import * as costing from '../../packages/modules/costing/service.js';
import { libraryCategories } from '../../packages/contracts/library.js';
import * as customers from '../../packages/modules/customers/service.js';
import * as projects from '../../packages/modules/projects/service.js';
import * as technical from '../../packages/modules/projects/technical-model.js';
import * as imports from '../../packages/modules/imports/service.js';
import { maxUploadBytes } from '../../packages/modules/imports/adapter.js';
import { uuid } from '../../packages/contracts/index.js';

export function buildServer(logging = false) {
  const env = getConfig();
  const app = Fastify({ logger: logging ? { redact: ['req.headers.cookie', 'req.headers.authorization'], serializers: { req: req => ({ method: req.method, url: req.url?.split('?')[0] }) } } : false, bodyLimit: 32768 });
  app.register(cookie); app.register(rateLimit, { max: 180, timeWindow: '1 minute' }); app.register(multipart, { limits: { fileSize: maxUploadBytes, files: 1, fields: 0 } });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== env.APP_ORIGIN) throw new DomainError(403, 'Request origin is not allowed.');
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) return reply.status(error.status).send({ error: error.message });
    if (error instanceof ZodError) return reply.status(400).send({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const e = error as { statusCode?: number; code?: string };
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.statusCode === 413 ? (request.url.startsWith('/api/library/') ? 'Library exceeds the 256 KiB limit.' : 'File exceeds the 20 MB limit.') : 'Invalid request. Please check your input.' });
    request.log.error({ code: e.code, requestId: request.id }, 'Request failed');
    return reply.status(503).send({ error: 'The service is unavailable. Check that the database and object storage are running, then retry.' });
  });
  app.get('/api/health', async () => ({ status: 'ok', mode: 'local-development' }));
  app.post('/api/client/redeem', {config:{rateLimit:{max:10,timeWindow:'1 minute'}}}, async(req,reply)=>{
    const {token}=z.object({token:z.string().max(100)}).strict().parse(req.body),session=await portal.redeem(token);
    reply.setCookie('moblux_client',session.token,{path:'/api/client',httpOnly:true,sameSite:'strict',secure:env.APP_ORIGIN.startsWith('https:'),expires:session.expiresAt});return {ok:true};
  });
  app.get('/api/client/snapshot',async req=>portal.view(req.cookies.moblux_client));
  app.post('/api/client/actions',async req=>portal.act(req.cookies.moblux_client,req.body));
  app.post('/api/client/logout',async(req,reply)=>{await portal.logout(req.cookies.moblux_client);reply.clearCookie('moblux_client',{path:'/api/client'});return {ok:true};});
  app.get<{Params:{snapshotId:string;assetId:string}}>('/api/client/media/:snapshotId/:assetId',async(req,reply)=>{const image=await portal.media(req.cookies.moblux_client,uuid.parse(req.params.snapshotId),uuid.parse(req.params.assetId));return reply.header('Content-Security-Policy',"default-src 'none'; sandbox").type(image.mime).send(image.bytes);});
  app.get<{Params:{id:string}}>('/api/projects/:id/client-access',async req=>portal.internalState(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id)));
  app.post<{Params:{id:string}}>('/api/projects/:id/client-access',async req=>portal.issue(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),req.body));
  app.post<{Params:{id:string;accessId:string}}>('/api/projects/:id/client-access/:accessId/revoke',async req=>portal.revoke(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.accessId)));
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { code } = z.object({ code: z.string().min(1).max(200) }).strict().parse(req.body);
    const token = await login(code); reply.setCookie('moblux_session', token, { path: '/', httpOnly: true, sameSite: 'strict', secure: env.APP_ORIGIN.startsWith('https:'), maxAge: 8 * 3600 }); return { ok: true };
  });
  app.post('/api/auth/logout', async (req, reply) => { if (req.cookies.moblux_session) await logout(req.cookies.moblux_session); reply.clearCookie('moblux_session', { path: '/' }); return { ok: true }; });
  app.get('/api/me', async req => { const user = await authenticate(req.cookies.moblux_session); if (user.kind !== 'staff') throw new DomainError(403, 'Customer access is not enabled in this slice.'); return { id: user.id, name: user.name, email: user.email, capabilities: [...user.grants].filter(c => !user.denies.has(c)) }; });
  app.get('/api/customers', async req => customers.listCustomers(await authenticate(req.cookies.moblux_session)));
  app.post('/api/customers', async (req, reply) => { const result = await customers.createCustomer(await authenticate(req.cookies.moblux_session), req.body); return reply.code(201).send(result); });
  app.get<{ Params: { id: string } }>('/api/customers/:id', async req => customers.customerDetail(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id)));
  app.get('/api/projects', async req => projects.listProjects(await authenticate(req.cookies.moblux_session)));
  app.post('/api/projects', async (req, reply) => { const result = await projects.createProject(await authenticate(req.cookies.moblux_session), req.body); return reply.code(201).send(result); });
  app.get<{ Params: { id: string } }>('/api/projects/:id', async req => projects.projectDetail(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id)));
  app.post<{ Params: { id: string } }>('/api/projects/:id/versions', async (req, reply) => { const result = await projects.createVersion(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), req.body); return reply.code(201).send(result); });
  app.post<{ Params: { id: string; versionId: string } }>('/api/projects/:id/versions/:versionId/sources', async (req, reply) => {
    const actor = await authenticate(req.cookies.moblux_session); const projectId = uuid.parse(req.params.id), versionId = uuid.parse(req.params.versionId), requestId = uuid.parse(req.headers['idempotency-key']);
    const file = await req.file(); if (!file) throw new DomainError(400, 'Choose a source file.');
    const body = await file.toBuffer(); if (file.file.truncated) throw new DomainError(413, 'File exceeds the 20 MB limit.');
    return reply.code(201).send(await imports.upload(actor, projectId, versionId, requestId, file.filename, body));
  });

  type QuoteParams={id:string;versionId:string;quoteId:string};
  const quotePath='/api/projects/:id/versions/:versionId/quotes';
  app.get<{Params:QuoteParams}>(quotePath,async req=>quotes.quoteState(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId)));
  app.post<{Params:QuoteParams}>(quotePath,{bodyLimit:1024*1024},async req=>quotes.saveQuote(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),req.body));
  app.post<{Params:QuoteParams}>(quotePath+'/calculate',{bodyLimit:1024*1024},async req=>quotes.calculateDraft(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),req.body));
  app.get<{Params:QuoteParams}>(quotePath+'/:quoteId/preview',async req=>quotes.quotePreview(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),uuid.parse(req.params.quoteId)));
  type PresentationParams={id:string;versionId:string;revisionId:string;assetId:string};
  const p='/api/projects/:id/versions/:versionId/presentations';
  app.get<{Params:PresentationParams}>(p,async req=>presentation.presentationState(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId)));
  app.post<{Params:PresentationParams}>(p,{bodyLimit:1024*1024},async req=>presentation.savePresentation(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),req.body));
  app.post<{Params:PresentationParams;Querystring:{kind:string;provenance?:string}}>(p+'/media',async(req,reply)=>{
    const actor=await authenticate(req.cookies.moblux_session);authorize(actor,'presentation.edit');authorize(actor,'project.view');
    const file=await req.file({limits:{fileSize:maxPresentationBytes,files:1,fields:0}});if(!file)throw new DomainError(400,'Choose a PNG or JPEG presentation image.');
    const bytes=await file.toBuffer();if(file.file.truncated)throw new DomainError(400,'Presentation image exceeds 10 MB.');
    return reply.code(201).send(await presentation.uploadPresentationMedia(actor,uuid.parse(req.params.id),uuid.parse(req.params.versionId),{requestId:uuid.parse(req.headers['idempotency-key']),kind:req.query.kind,provenance:req.query.provenance??''},file.filename,bytes));
  });
  app.get<{Params:PresentationParams}>(p+'/:revisionId/preview',async req=>presentation.previewPresentation(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),uuid.parse(req.params.revisionId)));
  for(const route of [p+'/media/:assetId',p+'/:revisionId/media/:assetId'])app.get<{Params:PresentationParams}>(route,async(req,reply)=>{
    const image=await presentation.presentationMedia(await authenticate(req.cookies.moblux_session),uuid.parse(req.params.id),uuid.parse(req.params.versionId),uuid.parse(req.params.assetId),req.params.revisionId?uuid.parse(req.params.revisionId):undefined);
    return reply.type(image.mime).header('Content-Disposition','inline').header('Content-Security-Policy',"sandbox; default-src 'none'").send(image.bytes);
  });
  app.get('/api/documents', async req => projects.listSources(await authenticate(req.cookies.moblux_session)));
  app.get('/api/library', async req => library.listLibrary(await authenticate(req.cookies.moblux_session)));
  app.get('/api/library/active', async req => resolution.activeLibraryState(await authenticate(req.cookies.moblux_session)));
  app.post('/api/library/active', async req => resolution.activateLibrary(await authenticate(req.cookies.moblux_session), req.body));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/material-resolution', async req => resolution.resolveMaterials(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/material-resolution', async req => resolution.resolutionState(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/optimization', async req => optimization.ensureOptimization(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/optimization', async req => optimization.optimizationHistory(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/hardware', async req => hardware.ensureHardware(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/hardware', async req => hardware.hardwareHistory(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/machining', async req => machining.ensureMachining(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/machining', async req => machining.machiningHistory(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/costing', async req => costing.costingState(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/costing/preview', async req => costing.costingState(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/costing/rules', {bodyLimit:262144}, async req => costing.saveCostRules(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/costing/runs', async req => costing.createCostRun(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body));
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/costing/overrides', async req => costing.overrideCostLine(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body));
  app.post<{ Params: { category: string } }>('/api/library/:category', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (req, reply) => {
    const actor = await authenticate(req.cookies.moblux_session); authorize(actor, 'library.import'); authorize(actor, 'library.view');
    const category = z.enum(libraryCategories).parse(req.params.category);
    const file = await req.file({ limits: { fileSize: 256 * 1024, files: 1, fields: 0 } });
    if (!file) throw new DomainError(400, 'Choose an original library file.');
    const bytes = await file.toBuffer(); if (file.file.truncated) throw new DomainError(413, 'Library exceeds 256 KiB.');
    return reply.code(201).send(await library.stageLibrary(actor, category, file.filename, bytes));
  });
  app.get<{ Params: { id: string } }>('/api/library/:id', async req => library.libraryDetail(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id)));
  app.get<{ Params: { id: string; index: string } }>('/api/library/:id/records/:index/raw', async req => library.rawLibraryRecord(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), z.coerce.number().int().min(1).max(2000).parse(req.params.index)));
  app.get<{ Params: { id: string } }>('/api/library/:id/download', async (req, reply) => {
    const file = await library.downloadLibrary(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id));
    return reply.type('application/octet-stream').header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`).header('Content-Security-Policy', "sandbox; default-src 'none'").send(Buffer.from(file.bytes));
  });
  app.post<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/library-matches', async (req, reply) => reply.code(201).send(await library.matchLibrary(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId), req.body)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId/library-matches', async req => library.listMatches(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.get<{ Params: { id: string } }>('/api/projects/:id/technical-models', async req => technical.listTechnicalModels(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id)));
  app.post<{ Params: { id: string } }>('/api/projects/:id/technical-models', async (req, reply) => reply.code(201).send(await technical.createTechnicalModel(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), req.body)));
  app.get<{ Params: { id: string; modelId: string } }>('/api/projects/:id/technical-models/:modelId', async req => technical.technicalModelDetail(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.modelId)));
  app.post<{ Params: { id: string; sourceId: string } }>('/api/projects/:id/sources/:sourceId/csv-imports', async (req, reply) => reply.code(201).send(await imports.importCsv(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.sourceId), req.body)));
  app.get<{ Params: { id: string; attemptId: string } }>('/api/projects/:id/csv-imports/:attemptId', async req => imports.csvReport(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id), uuid.parse(req.params.attemptId)));
  app.get<{ Params: { id: string } }>('/api/documents/:id/download', async (req, reply) => { const file = await imports.download(await authenticate(req.cookies.moblux_session), uuid.parse(req.params.id)); return reply.type('application/octet-stream').header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`).header('Content-Security-Policy', "sandbox; default-src 'none'").send(Buffer.from(file.bytes)); });
  return app;
}
