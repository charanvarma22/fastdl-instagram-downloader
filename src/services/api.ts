
export interface MediaItem {
    id: number | string;
    type: 'video' | 'image';
    thumbnail: string;
    mediaUrl: string;
    shortcode: string | null;
}

export interface PreviewResponse {
    type: 'video' | 'image' | 'carousel';
    items: MediaItem[];
    shortcode: string | null;
}

export const api = {
    getPreview: async (url: string): Promise<PreviewResponse> => {
        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch preview');
            }
            return data;
        } catch (error: any) {
            throw new Error(error.message || 'Network error');
        }
    },

    downloadMedia: async (url: string, itemIndex?: number, filename?: string) => {
        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, itemIndex })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Download failed");
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename || `instagram_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error: any) {
            console.error("Download error:", error);
            throw error;
        }
    }
};
