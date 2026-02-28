import { auth } from "../components/auth";
import { server_config } from "../config/index";



export async function* textChatStream(message: string): AsyncGenerator<any> {
    const payload = {
        text: message,
        username: auth.username,
        token: auth.message_token,
        // 其他必要的字段，例如用户 ID、会话 ID 等
    };

    // React Native 的 fetch 不支持 response.body ReadableStream，
    // 改用 XMLHttpRequest 的 onprogress 事件处理流式响应
    const queue: any[] = [];
    let notify: (() => void) | null = null;
    let xhrDone = false;
    let xhrError: Error | null = null;

    const wake = () => {
        if (notify) {
            const fn = notify;
            notify = null;
            fn();
        }
    };

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${server_config.BASE_URL}/chat`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    let processedLength = 0;
    let buffer = '';

    const processChunk = (text: string) => {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine.startsWith('data: ')) {
                const jsonStr = trimmedLine.substring(6);
                try {
                    queue.push(JSON.parse(jsonStr));
                } catch (e) {
                    console.warn('解析流式 JSON 失败:', e, '原始行:', trimmedLine);
                }
            }
        }
        wake();
    };

    xhr.onprogress = () => {
        const newData = (xhr.responseText || '').substring(processedLength);
        processedLength = (xhr.responseText || '').length;
        if (newData) processChunk(newData);
    };

    xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
            try {
                const errorData = JSON.parse(xhr.responseText);
                queue.push({ text: `Error: ${xhr.status}`, detail: errorData.detail });
            } catch {
                queue.push({ text: `Error: ${xhr.status}` });
            }
        }
        xhrDone = true;
        wake();
    };

    xhr.onerror = () => {
        xhrError = new Error(`Network error: ${xhr.status}`);
        xhrDone = true;
        wake();
    };

    xhr.send(JSON.stringify(payload));

    while (true) {
        if (queue.length === 0 && !xhrDone) {
            await new Promise<void>(resolve => { notify = resolve; });
        }

        while (queue.length > 0) {
            yield queue.shift();
        }

        if (xhrDone && queue.length === 0) break;
    }

    if (xhrError) throw xhrError;
}