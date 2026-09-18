export type SocketHandler = () => void;
export type SocketMessageHandler = (data: unknown) => void;
export type SocketErrorHandler = (error: unknown) => void;

type Unsubscribe = () => void;

export interface AisSocket {
  onOpen(handler: SocketHandler): Unsubscribe;
  onMessage(handler: SocketMessageHandler): Unsubscribe;
  onError(handler: SocketErrorHandler): Unsubscribe;
  onClose(handler: SocketHandler): Unsubscribe;
  send(payload: string): void;
  close(): void;
}

export type SocketFactory = (url: string) => AisSocket;

export const createNativeSocket: SocketFactory = (url) => {
  const socket = new WebSocket(url);

  return {
    onOpen(handler) {
      socket.addEventListener('open', handler);
      return () => socket.removeEventListener('open', handler);
    },
    onMessage(handler) {
      const listener = (event: MessageEvent) => handler(event.data);
      socket.addEventListener('message', listener);
      return () => socket.removeEventListener('message', listener);
    },
    onError(handler) {
      const listener = (event: Event) => handler(event);
      socket.addEventListener('error', listener);
      return () => socket.removeEventListener('error', listener);
    },
    onClose(handler) {
      socket.addEventListener('close', handler);
      return () => socket.removeEventListener('close', handler);
    },
    send(payload) {
      socket.send(payload);
    },
    close() {
      socket.close();
    },
  };
};
