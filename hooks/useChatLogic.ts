import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Keyboard } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChatMessage } from '../components/ChatBubbles';
import { imageChatStream, textChatStream } from '../utils/chat_stream';
import { setExpression } from '../utils/live2d_helper';


interface AgentResponse {
  text: string;
  audio: any;
  expression: string;
  is_final_package: boolean;
}

export const useChatLogic = (webviewRef?: React.RefObject<WebView | null>) => {
  const [inputText, setInputText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
  ]);
  const flatListRef = useRef<FlatList>(null);
  const audioFinishedResolver = useRef<(() => void) | null>(null);

  // 计算是否可以发送
  const canSend = inputText.trim().length > 0 && !processing;
  const canSendImage = !processing;

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'audio_finished') {
        if (audioFinishedResolver.current) {
          audioFinishedResolver.current(); // 唤醒 processAgentResponse
          audioFinishedResolver.current = null;
        }
      } else{
        console.log('收到 WebView 消息:', data);
      }
    } catch (e) {
      console.error("WebView message parse error", e);
    }
  }, []);

  const addAgentMessage = useCallback((text: string) => {
    const agentMessage: ChatMessage = {
      uuid: Date.now().toString() + Math.random().toString(36).substring(2), // 确保唯一
      type: 'text',
      content: text,
      isUser: false,
      timestamp: Date.now()
    };
    setMessages(prev => [agentMessage, ...prev]);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const processAgentResponse = useCallback(async (stream: AsyncGenerator<AgentResponse>) => {
    for await (const response of stream) {
      if (response.text)
        addAgentMessage(response.text);
      if (response.expression)
        setExpression(response.expression, webviewRef!);
      if (response.audio) {
        // 发送音频数据块
        webviewRef!.current?.injectJavaScript(`window.feedAudioChunk('${response.audio}', false); true;`);
      }

      if (response.is_final_package) {
        // 发送结束标志
        webviewRef!.current?.injectJavaScript(`window.feedAudioChunk('', true); true;`);
        await new Promise<void>((resolve) => {
          audioFinishedResolver.current = resolve;
        });
      }
    }
    setProcessing(false);
    }, [addAgentMessage, webviewRef]);

  // 发送文本消息
  const handleSendText = async () => {
    if (!canSend) {
      return;
    }

    const newMessage: ChatMessage = {
      uuid: Date.now().toString(),
      type: 'text',
      content: inputText,
      isUser: true,
      timestamp: Date.now()
    };
    setMessages([newMessage, ...messages]);
    setInputText('');
    Keyboard.dismiss();

    // 设置为处理中
    setProcessing(true);

    // 调用流式聊天接口
    const stream = textChatStream(inputText);
    processAgentResponse(stream);
  };

  // 发送图片消息
  const handleSendImage = async () => {
    if (!canSendImage) {
      return;
    }
    
    // 1. 调用图片选择器
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const imageUri = asset.uri;
    const mimeType = asset.mimeType || 'image/jpeg'; 

    // 2. 增加 ChatMessage
    const newMessage: ChatMessage = {
      uuid: Date.now().toString(),
      type: 'image',
      content: imageUri,
      isUser: true,
      timestamp: Date.now()
    };
    setMessages(prev => [newMessage, ...prev]);
    
    // 设置为处理中
    setProcessing(true);

    // 3. 调用流式聊天接口
    try {
        // cast stream to any because Generator yield types might mismatch if define strict
        const stream = imageChatStream(imageUri, mimeType);
        // 4. 调用 processAgentResponse
        await processAgentResponse(stream);
    } catch (error) {
        console.error("Image chat failed", error);
        addAgentMessage("Image upload failed: " + error);
        setProcessing(false);
    }
  };

  const addHistoryMessage = useCallback((newMessages: ChatMessage[]) => {
    setMessages(prev => {
      const nowScrollIndex = prev.length - 1; // 当前最新消息的索引
      // 将newMessages倒序添加到前面，这样FlatList才能正确显示历史消息

      const next = [...prev, ...newMessages.reverse()]; // inverted order
      // 恢复之前的滚动位置
      if (nowScrollIndex >= 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: nowScrollIndex, animated: false });
        }, 10);
      } else {
        // 如果之前没有消息了，直接滚动到最后
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        }, 10);
      }
      return next;
    });
  }, []);

  return {
    // 状态
    inputText,
    processing,
    messages,
    flatListRef,
    canSend,
    canSendImage,

    // 方法
    setInputText,
    addHistoryMessage,
    handleSendText,
    handleSendImage,
    handleWebViewMessage
  };
};
