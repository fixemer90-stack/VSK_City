export type Role = 'agent' | 'director';
export type Action = 'property'|'motor'|'motor-100'|'terminate-property'|'terminate-motor'|'advance-day'|'reset';
export interface House {id:string;lotIndex:number;xp:number;tier:number;floors:number;status:'active'|'pending_demolition';demolishAt:string|null}
export interface Parking {id:string;lotIndex:number;spaces:number}
export interface Street {id:string;agentId:string;name:string|null;scenario:string;houses:House[];parking:Parking[]}
export interface City {id:string;name:string;mapX:number;mapY:number;streets:Street[]}
export interface State {mode:string;version:number;rulesVersion?:number;now:string;viewer:{agentId:string;streetId:string;cityId:string;firstName:string;lastName:string;role:Role};cities:City[]}
export {cityBlockPosition} from './city-layout';
export {streetLotPosition as lotPosition} from './street-layout';
export function scenarioLabel(scenario:string):string {return ({empty:'Чистый лист',motor_only:'Автомобильный квартал',property_only:'Жилые дома',mixed:'Живой квартал',developed:'Развитая улица',skyscraper:'Высотный силуэт',overflow:'Город и парковки',large:'Большая улица',property_termination:'Отложенный снос',motor_termination:'Моторное изменение'} as Record<string,string>)[scenario] ?? scenario.replaceAll('_',' ');}
export class ApiError extends Error {constructor(message:string,public uncertain=false){super(message)}}
export class DemoApi {
  constructor(private transport:typeof fetch=fetch){}
  async state(agentId:string,role:Role,signal?:AbortSignal):Promise<State> {return this.request(`/api/demo/state?${new URLSearchParams({agentId,role})}`,{signal});}
  async action(agentId:string,role:Role,type:Action,requestId:string):Promise<State> {return this.request(`/api/demo/actions?${new URLSearchParams({agentId,role})}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId,type,requestId})});}
  private async request(url:string,init:RequestInit):Promise<State> {
    let response:Response;
    const deadline=AbortSignal.timeout(20000);const signal=init.signal?AbortSignal.any([init.signal,deadline]):deadline;
    try {response=await this.transport.call(globalThis,url,{...init,signal});} catch(e){if(signal.reason instanceof DOMException&&signal.reason.name==='TimeoutError')throw new ApiError('Превышено время ожидания сервера. Повторите запрос.',init.method==='POST');if(e instanceof DOMException&&e.name==='AbortError')throw e;throw new ApiError('Сервер недоступен. Проверьте подключение и повторите запрос.',init.method==='POST');}
    let data:unknown;try {data=await response.json();}catch {throw new ApiError('Сервер вернул нечитаемый ответ.',init.method==='POST');}
    if(!response.ok)throw new ApiError((data as {message?:string})?.message??`Ошибка сервера (${response.status})`,response.status>=500&&init.method==='POST');
    const s=data as State;if(!s||typeof s!=='object'||!Array.isArray(s.cities)||!s.viewer||!s.now)throw new ApiError('Ответ не соответствует формату демонстрационного мира.',init.method==='POST');return s;
  }
}
