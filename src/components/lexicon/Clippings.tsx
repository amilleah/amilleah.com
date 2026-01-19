import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import lexiconData from "../../data/lexicon.json";

type ItemType = 'image' | 'text';

interface PoemItem {
  id: string;
  type: ItemType;
  content: string;
  src?: string;
  source?: string;
}

interface Clipping {
  id: string;
  word: string;
  source: string;
  src: string;
}

export default function Clippings() {
  const [poem, setPoem] = useState<PoemItem[]>([]);
  const [inputText, setInputText] = useState('');
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const bankStanzas = Object.entries(
    (lexiconData as Clipping[])
      .filter((clip) => !poem.find((p) => p.id === clip.id))
      .reduce((acc, clip) => {
        const key = clip.source;
        if (!acc[key]) acc[key] = [];
        acc[key].push({
          id: clip.id,
          type: 'image',
          content: clip.word,
          src: clip.src,
          source: clip.source
        });
        return acc;
      }, {} as Record<string, PoemItem[]>)
  );

  const addToPoem = (item: PoemItem) => {
    setPoem((prev) => [...prev, item]);
  };

  const removeFromPoem = (itemId: string) => {
    setPoem((prev) => prev.filter((p) => p.id !== itemId));
  };

  const clearPoem = () => {
    setPoem([]);
  };

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const newItem: PoemItem = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: inputText.trim()
    };
    
    addToPoem(newItem);
    setInputText('');
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    if (dragItem.current === null) return;
    
    const dragIndex = dragItem.current;
    if (dragIndex === index) return;

    const newPoem = [...poem];
    const draggedItemContent = newPoem[dragIndex];

    newPoem.splice(dragIndex, 1);
    newPoem.splice(index, 0, draggedItemContent);

    dragItem.current = index;
    setPoem(newPoem);
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div className="space-y-12 py-6">
      
      <div className="min-h-[200px] w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 transition-colors relative flex flex-col justify-between group/canvas">
        
        {poem.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm font-mono select-none pointer-events-none">
            double-click words or type below...
          </p>
        )}

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-6 mb-8">
          <AnimatePresence>
            {poem.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDoubleClick={() => removeFromPoem(item.id)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="cursor-move relative group touch-none"
              >
                {item.type === 'image' ? (
                  <img
                    src={item.src}
                    alt={item.content}
                    draggable={false}
                    className="h-12 w-auto object-contain drop-shadow-sm filter sepia-[0.15] hover:sepia-0 transition-all duration-300 ease-out select-none"
                  />
                ) : (
                  <span className="font-mono text-lg text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 px-2 py-1 rounded shadow-sm border border-zinc-200 dark:border-zinc-700 select-none">
                    {item.content}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="relative mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center">
          <form onSubmit={handleAddText} className="flex-grow">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="add missing words..."
              className="w-full bg-transparent text-sm font-mono text-zinc-600 dark:text-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:outline-none pr-20"
            />
          </form>
          {poem.length > 0 && (
            <button 
              onClick={clearPoem}
              className="absolute right-0 bottom-0.5 text-xs font-mono text-zinc-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 transition-colors"
            >
              x clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-12">
        {bankStanzas.map(([sourceName, groupClips]) => (
          <section key={sourceName} className="relative">
            <h3 className="text-xs font-mono text-zinc-400 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-1 inline-block">
              src: {sourceName}
            </h3>
            
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-4 pl-2">
              <AnimatePresence>
                {groupClips.map((clip) => (
                  <motion.div
                    key={clip.id}
                    layoutId={clip.id}
                    onDoubleClick={() => addToPoem(clip)}
                    className="relative group cursor-pointer"
                    title={clip.content}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <img
                      src={clip.src}
                      alt={clip.content}
                      className="h-10 w-auto object-contain drop-shadow-sm filter sepia-[0.15] opacity-70 group-hover:opacity-100 group-hover:sepia-0 transition-all duration-300 ease-out select-none"
                      loading="lazy"
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}