'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Skeleton } from './ui/skeleton';

interface EditableTextProps {
  docPath: string; // e.g. "site_content/home"
  fieldKey: string; // e.g. "title"
  defaultValue: string;
  render: (text: string) => React.ReactNode;
  textarea?: boolean;
  className?: string;
}

export function EditableText({
  docPath,
  fieldKey,
  defaultValue,
  render,
  textarea = false,
  className,
}: EditableTextProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const docRef = useMemo(
    () => (firestore ? doc(firestore, docPath) : null),
    [firestore, docPath]
  );

  const { data: docData, loading } = useDoc(docRef);
  
  // This logic is a bit complex because some fields are direct properties
  // and some are nested inside the `content` map.
  const currentText = (docData && fieldKey in docData) 
    ? docData[fieldKey] 
    : (docData?.content && fieldKey in docData.content) 
      ? docData.content[fieldKey] 
      : defaultValue;


  useEffect(() => {
    if (isEditing) {
      setEditText(currentText);
    }
  }, [isEditing, currentText]);

  const handleSave = async () => {
    if (!docRef) return;
    setIsSubmitting(true);
    
    // Determine if the key is a top-level property or nested in `content`
    const isTopLevelField = ['header_title', 'footer_text'].includes(fieldKey);
    
    const dataToSet = isTopLevelField 
    ? { [fieldKey]: editText }
    : {
        content: {
            ...docData?.content,
            [fieldKey]: editText,
        }
      };


    setDoc(docRef, dataToSet, { merge: true })
      .then(() => {
        toast({ title: 'Текст обновлен!' });
        setIsEditing(false);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: dataToSet,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Ошибка сохранения',
          description: serverError.message,
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (loading) {
     return <Skeleton className="h-8 w-1/2" />;
  }

  return (
    <div className={`group relative ${className}`}>
      {render(currentText)}
      {user?.isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 bg-background/50 hover:bg-background"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {user?.isAdmin && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактировать текст</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {textarea ? (
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[120px] resize-y"
                  disabled={isSubmitting}
                />
              ) : (
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  disabled={isSubmitting}
                />
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isSubmitting}>
                  Отмена
                </Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
