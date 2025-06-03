// Editor-specific JavaScript for NoteVault

// Auto-save functionality
class AutoSave {
    constructor(noteId, saveEndpoint) {
        this.noteId = noteId;
        this.saveEndpoint = saveEndpoint;
        this.saveTimer = null;
        this.lastSaved = Date.now();
        this.isDirty = false;
    }

    scheduleeSave(content) {
        this.isDirty = true;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.save(content);
        }, 2000); // Save after 2 seconds of inactivity
    }

    async save(content) {
        if (!this.isDirty || !this.noteId) return;

        try {
            const response = await fetch(this.saveEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    note_id: this.noteId,
                    content: content
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.isDirty = false;
                this.lastSaved = Date.now();
                this.showSaveIndicator();
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    showSaveIndicator() {
        const indicator = document.getElementById('autosaveIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 2000);
        }
    }

    forceSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            if (this.isDirty && window.quill) {
                this.save(window.quill.root.innerHTML);
            }
        }
    }
}

// Editor utilities
class EditorUtils {
    static setupQuill(options = {}) {
        const defaultOptions = {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    ['link', 'blockquote', 'code-block'],
                    [{ 'align': [] }],
                    ['clean']
                ]
            },
            placeholder: 'Start writing your note...',
            ...options
        };

        return new Quill('#noteContent', defaultOptions);
    }

    static getWordCount(content) {
        const text = content.replace(/<[^>]*>/g, '').trim();
        return text ? text.split(/\s+/).length : 0;
    }

    static getCharCount(content) {
        return content.replace(/<[^>]*>/g, '').length;
    }

    static extractPlainText(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    static createExcerpt(content, maxLength = 150) {
        const plainText = this.extractPlainText(content);
        return plainText.length > maxLength 
            ? plainText.substring(0, maxLength) + '...'
            : plainText;
    }
}

// Note sharing functionality
class NoteSharing {
    constructor(noteId) {
        this.noteId = noteId;
    }

    async generateShareLink() {
        try {
            const response = await fetch(`/note/${this.noteId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (data.success) {
                return data.share_url;
            } else {
                throw new Error('Failed to generate share link');
            }
        } catch (error) {
            console.error('Share error:', error);
            throw error;
        }
    }

    async copyShareLink() {
        try {
            const shareUrl = await this.generateShareLink();
            await window.NoteVault.copyToClipboard(shareUrl);
            window.NoteVault.showToast('Share link copied to clipboard!', 'success');
            return shareUrl;
        } catch (error) {
            window.NoteVault.showToast('Failed to copy share link', 'danger');
            throw error;
        }
    }

    showShareModal(shareUrl) {
        const modal = document.getElementById('shareModal');
        const shareInput = document.getElementById('shareLink');
        
        if (modal && shareInput) {
            shareInput.value = shareUrl;
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }
}

// Export functionality
class NoteExporter {
    constructor(noteId) {
        this.noteId = noteId;
    }

    exportToPDF() {
        window.open(`/note/${this.noteId}/export/pdf`, '_blank');
    }

    exportToText() {
        window.open(`/note/${this.noteId}/export/txt`, '_blank');
    }

    async exportToJSON() {
        // This would require additional backend support
        try {
            const response = await fetch(`/note/${this.noteId}/export/json`);
            const data = await response.json();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], 
                { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `note-${this.noteId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            window.NoteVault.showToast('Export failed', 'danger');
        }
    }
}

// Keyboard shortcuts for editor
class EditorShortcuts {
    constructor(editor) {
        this.editor = editor;
        this.setupShortcuts();
    }

    setupShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when editor is focused
            if (!this.editor || !this.isEditorFocused()) return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (ctrlKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.editor.execCommand('Bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.editor.execCommand('Italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.editor.execCommand('Underline');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.editor.execCommand('mceLink');
                        break;
                    case 'z':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.editor.execCommand('Redo');
                        } else {
                            e.preventDefault();
                            this.editor.execCommand('Undo');
                        }
                        break;
                }
            }
        });
    }

    isEditorFocused() {
        const iframe = document.querySelector('#noteContent_ifr');
        return iframe && iframe.contentDocument && 
               iframe.contentDocument.hasFocus();
    }
}

// Word and character counter
class EditorCounter {
    constructor(editor, counterId) {
        this.editor = editor;
        this.counter = document.getElementById(counterId);
        this.setupCounter();
    }

    setupCounter() {
        if (!this.counter) return;

        this.editor.on('keyup', () => {
            this.updateCount();
        });

        this.editor.on('change', () => {
            this.updateCount();
        });
    }

    updateCount() {
        const content = this.editor.getContent();
        const wordCount = EditorUtils.getWordCount(content);
        const charCount = EditorUtils.getCharCount(content);
        
        this.counter.textContent = `${wordCount} words, ${charCount} characters`;
    }
}

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Global editor instance
    window.noteEditor = null;
    window.autoSave = null;
    window.noteSharing = null;
    window.noteExporter = null;

    // Initialize Quill if div exists
    const noteContent = document.getElementById('noteContent');
    if (noteContent && typeof Quill !== 'undefined') {
        const noteId = window.noteId || null;
        
        window.noteEditor = EditorUtils.setupQuill();
        window.quill = window.noteEditor;
        
        // Setup auto-save
        if (noteId) {
            window.autoSave = new AutoSave(noteId, '/api/autosave');
            
            window.noteEditor.on('text-change', function() {
                window.autoSave.scheduleeSave(window.noteEditor.root.innerHTML);
            });
        }

        // Initialize sharing and export if note exists
        if (noteId) {
            window.noteSharing = new NoteSharing(noteId);
            window.noteExporter = new NoteExporter(noteId);
        }
    }

    // Before page unload, force save
    window.addEventListener('beforeunload', function(e) {
        if (window.autoSave) {
            window.autoSave.forceSave();
        }
    });
});

// Global functions for use in templates
window.shareNote = function() {
    if (window.noteSharing) {
        window.noteSharing.generateShareLink().then(shareUrl => {
            window.noteSharing.showShareModal(shareUrl);
        }).catch(error => {
            window.NoteVault.showToast('Failed to generate share link', 'danger');
        });
    }
};

window.copyShareLink = function() {
    if (window.noteSharing) {
        window.noteSharing.copyShareLink();
    }
};

window.deleteNote = function() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        new bootstrap.Modal(modal).show();
    }
};

window.exportNote = function(format) {
    if (!window.noteExporter) return;

    switch (format) {
        case 'pdf':
            window.noteExporter.exportToPDF();
            break;
        case 'txt':
            window.noteExporter.exportToText();
            break;
        case 'json':
            window.noteExporter.exportToJSON();
            break;
    }
};
