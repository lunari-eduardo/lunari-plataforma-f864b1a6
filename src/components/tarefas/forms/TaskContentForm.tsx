import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import RichTextEditor from '@/components/ui/rich-text-editor';

interface TaskContentFormProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  callToAction: string;
  setCallToAction: (value: string) => void;
  hashtags: string[];
  setHashtags: (value: string[]) => void;
  socialPlatforms: string[];
  setSocialPlatforms: (value: string[] | ((prev: string[]) => string[])) => void;
}

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'];

export default function TaskContentForm({ 
  title, 
  setTitle, 
  description, 
  setDescription,
  callToAction,
  setCallToAction,
  hashtags,
  setHashtags,
  socialPlatforms,
  setSocialPlatforms
}: TaskContentFormProps) {
  const [newHashtag, setNewHashtag] = useState('');

  const addHashtag = () => {
    if (newHashtag.trim() && !hashtags.includes(newHashtag.trim())) {
      setHashtags([...hashtags, newHashtag.trim()]);
      setNewHashtag('');
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  const togglePlatform = (platform: string) => {
    setSocialPlatforms((prev: string[]) => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título do Post *</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
          placeholder="Ex.: Post ensaio newborn - Maria" 
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Conteúdo da Legenda</Label>
        <RichTextEditor 
          value={description} 
          onChange={setDescription} 
          placeholder="Escreva a legenda para o post..."
          minHeight="120px"
        />
        <div className="text-xs text-lunar-textSecondary text-right">
          {description.replace(/<[^>]*>/g, '').length}/2200 caracteres
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cta">Call to Action (CTA)</Label>
        <Input 
          id="cta" 
          value={callToAction} 
          onChange={e => setCallToAction(e.target.value)} 
          placeholder="Ex.: Agende sua sessão no link da bio 📸" 
        />
      </div>

      <div className="space-y-1.5">
        <Label>Plataformas</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(platform => (
            <Button
              key={platform}
              type="button"
              variant={socialPlatforms.includes(platform) ? "default" : "outline"}
              size="sm"
              onClick={() => togglePlatform(platform)}
              className="capitalize"
            >
              {platform}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Hashtags</Label>
        <div className="flex gap-2">
          <Input
            value={newHashtag}
            onChange={e => setNewHashtag(e.target.value)}
            placeholder="Digite uma hashtag"
            onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
          />
          <Button type="button" onClick={addHashtag} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {hashtags.map(tag => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                #{tag}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => removeHashtag(tag)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </>
  );
}