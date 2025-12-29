-- Create storage bucket for video uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', false, 104857600, ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm']);

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videos');

-- Allow authenticated users to read their own videos
CREATE POLICY "Users can read videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videos');

-- Allow authenticated users to delete their videos
CREATE POLICY "Users can delete videos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'videos');