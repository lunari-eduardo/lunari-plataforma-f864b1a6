/**
 * Event Bus tipado in-process. Cada módulo declara seu catálogo de eventos
 * estendendo `LunariEvents` via declaration merging:
 *
 *   declare module "@/shared/event-bus" {
 *     interface LunariEvents {
 *       "agenda.rescheduled": { appointmentId: string; newDate: string };
 *     }
 *   }
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LunariEvents {}

export type EventName = keyof LunariEvents & string;
export type EventPayload<N extends EventName> = LunariEvents[N];

export interface DomainEvent<N extends EventName = EventName> {
  name: N;
  payload: EventPayload<N>;
  occurredAt: string;
  /** ID da capability que emitiu (para auditoria/rastro). */
  source?: string;
  /** ID do usuário cuja ação originou o evento. */
  actorId?: string | null;
}

type Listener<N extends EventName> = (event: DomainEvent<N>) => void | Promise<void>;

class EventBus {
  private listeners = new Map<EventName, Set<Listener<EventName>>>();
  private wildcards = new Set<Listener<EventName>>();

  on<N extends EventName>(name: N, listener: Listener<N>): () => void {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener as Listener<EventName>);
    this.listeners.set(name, set);
    return () => set.delete(listener as Listener<EventName>);
  }

  onAny(listener: Listener<EventName>): () => void {
    this.wildcards.add(listener);
    return () => this.wildcards.delete(listener);
  }

  async emit<N extends EventName>(
    name: N,
    payload: EventPayload<N>,
    meta: { source?: string; actorId?: string | null } = {},
  ): Promise<void> {
    const event: DomainEvent<N> = {
      name,
      payload,
      occurredAt: new Date().toISOString(),
      ...meta,
    };

    const targeted = this.listeners.get(name);
    const all = [
      ...(targeted ? Array.from(targeted) : []),
      ...Array.from(this.wildcards),
    ];

    await Promise.all(
      all.map(async (l) => {
        try {
          await l(event as DomainEvent<EventName>);
        } catch (e) {
          console.error(`[event-bus] listener for "${name}" threw`, e);
        }
      }),
    );
  }

  /** Útil para testes. */
  clear() {
    this.listeners.clear();
    this.wildcards.clear();
  }
}

export const eventBus = new EventBus();
export type { EventBus };
