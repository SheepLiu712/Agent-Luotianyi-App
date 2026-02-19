import { useCallback, useRef, useState } from 'react';
import { FlatList, Keyboard } from 'react-native';
import { ChatMessage } from '../components/ChatBubbles';

export const useChatLogic = () => {
  const [inputText, setInputText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
  ]);
  const flatListRef = useRef<FlatList>(null);

  // 计算是否可以发送
  const canSend = inputText.trim().length > 0 && !processing;
  const canSendImage = !processing;

  // 发送文本消息
  const handleSendText = () => {
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

    // 滚动到底部
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // TODO: 这里后续会添加调用服务器的逻辑
    // 模拟回复
    setTimeout(() => {
      const botReply: ChatMessage = {
        uuid: (Date.now() + 1).toString(),
        type: 'text',
        content: '我收到了你的消息~',
        isUser: false,
        timestamp: Date.now()
      };
      setMessages(prev => [botReply, ...prev]);
      
      // 处理完成，恢复可发送状态
      setProcessing(false);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1000);
  };

  // 发送图片消息
  const handleSendImage = () => {
    console.log('发送图片');
    // TODO: 后续实现图片选择功能
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
  };
};
