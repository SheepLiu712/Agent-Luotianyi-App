import { local_config } from '@/config';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, StyleProp, View } from 'react-native';
import { getImage, ImageResponse, updateImagePath } from '../utils/getHistory';
import { auth } from './auth';

const ERROR_IMAGE_URI = Image.resolveAssetSource(local_config.ERROR_IMAGE).uri;

interface CachedImageProps {
    message_id: string;      // 服务器图片地址
    localUri: string;       // 预期的本地缓存路径
    style?: StyleProp<ImageStyle>;
}

export const CachedImage: React.FC<CachedImageProps> = ({ message_id, localUri, style }) => {
    const [imgSource, setImgSource] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadImg = async () => {
            try {
                // 1. 检查本地是否存在
                const fileInfo = await FileSystem.getInfoAsync(localUri);

                if (fileInfo.exists) {
                    if (isMounted) setImgSource(fileInfo.uri);
                } else {
                    // 2. 本地不存在，尝试从服务器获取图片
                    const result: ImageResponse = await getImage(auth.username, auth.message_token, message_id);
                    if (result.success && result.newClientPath) {
                        // 3. 成功获取并缓存图片后，更新服务器记录的路径
                        updateImagePath(auth.username, auth.message_token, message_id, result.newClientPath);
                        if (isMounted) setImgSource(result.newClientPath);
                    }
                    else {
                        throw new Error('图片获取失败');
                    }
                }
            } catch (e) {
                console.error("CachedImage 错误:", e);
                // 如果缓存失败，退而求其次直接展示网络图片
                if (isMounted) setImgSource(ERROR_IMAGE_URI);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadImg();
        return () => { isMounted = false; }; // 防止组件卸载后还在设置状态
    }, [message_id, localUri]);

    if (loading) {
        return (
            <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
                <ActivityIndicator size="small" color="#999" />
            </View>
        );
    }

    return <Image source={{ uri: imgSource || ERROR_IMAGE_URI }} style={style} />;
};