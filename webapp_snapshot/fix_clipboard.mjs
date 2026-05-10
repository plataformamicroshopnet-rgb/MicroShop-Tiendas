import fs from 'fs';

function fixClipboard(filePath) {
    let file = fs.readFileSync(filePath, 'utf8');

    const regex = /const confirmMail = \(\) => \{[\s\S]*?setShowMailModal\(false\)\r?\n\s*\}/;
    
    const newConfirmMail = `const confirmMail = async () => {
        const daysToRender = weekDays.filter(d => selectedMailDays.includes(formatDate(d)));
        if (daysToRender.length === 0) return alert('Selecciona al menos un día.');
        
        const html = renderAgendaTableHTML(daysToRender);
        
        try {
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob(['Agenda copiada'], { type: 'text/plain' });
            const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
            await navigator.clipboard.write(data);
            alert('¡Copiado al portapapeles correctamente! Ya puedes pegarlo en tu cliente de correo.');
            setShowMailModal(false);
        } catch (err) {
            console.error('Error copying via ClipboardItem:', err);
            try {
                // Fallback for Safari/Firefox
                const div = document.createElement("div");
                div.innerHTML = html;
                div.style.position = "fixed";
                div.style.left = "-9999px";
                document.body.appendChild(div);
                
                const range = document.createRange();
                range.selectNodeContents(div);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
                
                const successful = document.execCommand('copy');
                selection?.removeAllRanges();
                document.body.removeChild(div);
                
                if (successful) {
                    alert('¡Copiado al portapapeles correctamente! Ya puedes pegarlo en tu correo.');
                } else {
                    alert('Fallo al copiar automáticamente. Por favor comprueba los permisos de tu navegador.');
                }
                setShowMailModal(false);
            } catch (e) {
                alert('El navegador bloqueó la copia silenciosa. Por favor usa CTRL+C seleccionando la tabla.');
            }
        }
    }`;

    file = file.replace(regex, newConfirmMail);
    fs.writeFileSync(filePath, file);
}

fixClipboard('src/app/seguimiento-ventas/agenda/page.tsx');
fixClipboard('src/app/seguimiento-ventas/agenda-cristina/page.tsx');
