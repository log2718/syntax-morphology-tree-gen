// TREE DATA MODEL

class TreeModel {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nextNodeId = 1;
        this.nextEdgeId = 1;
    }

    createNode(label, x, y, type = 'CAT') {
        const node = {
            id: `node-${this.nextNodeId++}`,
            label: label || 'Label',
            x: x,
            y: y,
            width: 100,
            height: 40,
            type
        };
        this.nodes.push(node);
        return node;
    }

    deleteNode(nodeId) {
        // Remove the node
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        // Remove all incident edges
        this.edges = this.edges.filter(e => e.parentId !== nodeId && e.childId !== nodeId);
    }

    createEdge(parentId, childId) {
        const edge = {
            id: `edge-${this.nextEdgeId++}`,
            parentId: parentId,
            childId: childId
        };
        this.edges.push(edge);
        return edge;
    }

    deleteEdge(edgeId) {
        this.edges = this.edges.filter(e => e.id !== edgeId);
    }

    findEdgeByNodeIds(parentId, childId) {
        return this.edges.find(e => e.parentId === parentId && e.childId === childId);
    }

    getChildrenOf(nodeId) {
        return this.edges
            .filter(e => e.parentId === nodeId)
            .map(e => this.nodes.find(n => n.id === e.childId))
            .filter(n => n);
    }

    getParentOf(nodeId) {
        const edge = this.edges.find(e => e.childId === nodeId);
        if (!edge) return null;
        return this.nodes.find(n => n.id === edge.parentId);
    }

    getRoots() {
        return this.nodes.filter(n => !this.getParentOf(n.id));
    }

    isAncestor(potentialAncestorId, nodeId) {
        let current = this.getParentOf(nodeId);
        while (current) {
            if (current.id === potentialAncestorId) return true;
            current = this.getParentOf(current.id);
        }
        return false;
    }

    clear() {
        this.nodes = [];
        this.edges = [];
    }
}

// UI STATE MANAGER

class UIState {
    constructor() {
        this.selectedNode = null;
        this.selectedEdge = null;
        this.addDescendentMode = false;
        this.addDescendentParentId = null;
    }

    selectNode(nodeId) {
        this.selectedNode = nodeId;
        this.selectedEdge = null;
    }

    selectEdge(edgeId) {
        this.selectedEdge = edgeId;
        this.selectedNode = null;
    }

    clearSelection() {
        this.selectedNode = null;
        this.selectedEdge = null;
    }

    enterAddDescendentMode(parentId) {
        this.addDescendentMode = true;
        this.addDescendentParentId = parentId;
    }

    exitAddDescendentMode() {
        this.addDescendentMode = false;
        this.addDescendentParentId = null;
    }
}

// TREE APP MANAGER

class TreeApp {
    constructor() {
        this.model = new TreeModel();
        this.ui = new UIState();

        // DOM elements
        this.canvas = document.getElementById('canvas');
        this.svg = document.getElementById('edges-svg');

        // Buttons
        this.addDescendentBtn = document.getElementById('add-descendent-btn');
        this.deleteBtn = document.getElementById('delete-btn');
        this.autoLayoutBtn = document.getElementById('auto-layout-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.resetBtn = document.getElementById('reset-btn');

        this.draggedNode = null;
        this.draggedElement = null;
        this.dragInitialX = 0;
        this.dragInitialY = 0;
        this.dragNodeStartX = 0;
        this.dragNodeStartY = 0;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Make sidebar blocks draggable
        document.querySelectorAll('.block').forEach(block => {
            block.draggable = true;
        });

        // Custom block handling
        document.addEventListener('click', (e) => this.onCustomBlockClick(e));

        // Sidebar drag
        document.addEventListener('dragstart', (e) => this.onBlockDragStart(e));
        document.addEventListener('dragend', (e) => this.onBlockDragEnd(e));

        // Canvas drop
        this.canvas.addEventListener('dragover', (e) => this.onCanvasDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.onCanvasDrop(e));

        // Canvas click
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));

        // SVG edge click
        this.svg.addEventListener('click', (e) => this.onSVGClick(e));

        // Node interactions
        document.addEventListener('pointerdown', (e) => this.onNodePointerDown(e));
        document.addEventListener('pointermove', (e) => this.onNodePointerMove(e));
        document.addEventListener('pointerup', (e) => this.onNodePointerUp(e));

        // Keyboard
        document.addEventListener('keydown', (e) => this.onKeyDown(e));

        // Toolbar buttons
        this.addDescendentBtn.addEventListener('click', () => this.onAddDescendentClick());
        this.deleteBtn.addEventListener('click', () => this.onDeleteClick());
        this.autoLayoutBtn.addEventListener('click', () => this.onAutoLayoutClick());
        this.clearBtn.addEventListener('click', () => this.onClearClick());
        this.exportBtn.addEventListener('click', () => this.onExportClick());
        this.importBtn.addEventListener('click', () => this.onImportClick());

        // Sidebar reset button
        this.resetBtn.addEventListener('click', () => this.onResetClick());

        // Double-click node to edit label
        document.addEventListener('dblclick', (e) => this.onNodeDoubleClick(e));
    }

    // CUSTOM BLOCK HANDLING

    onCustomBlockClick(e) {
        const customBlock = e.target.closest('.block.custom-syntax, .block.custom-morphology');
        if (!customBlock) return;

        e.preventDefault();

        const newLabel = prompt('Enter custom label:', 'Custom');
        if (!newLabel || !newLabel.trim()) return;

        const label = newLabel.trim();
        const isCustomSyntax = customBlock.classList.contains('custom-syntax');
        const blockList = customBlock.closest('.block-list');

        // Create new custom block with the given label
        const newBlock = document.createElement('div');
        newBlock.className = `block ${isCustomSyntax ? 'custom-syntax' : 'custom-morphology'}`;
        newBlock.textContent = label;
        newBlock.draggable = true;
        newBlock.classList.add('user-custom');

        // Insert before the "custom" block
        blockList.insertBefore(newBlock, customBlock);
    }

    // DRAG-DROP FROM SIDEBAR

    onBlockDragStart(e) {
        if (!e.target.classList.contains('block')) return;
        const label = e.target.textContent.trim();
        const type = e.target.classList.contains('word-block') ? 'WORD' : 'CAT';
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/label', label);
        e.dataTransfer.setData('text/type', type);
    }

    onBlockDragEnd(e) {
        // Cleanup if needed
    }

    onCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    onCanvasDrop(e) {
        e.preventDefault();
        let label = e.dataTransfer.getData('text/label');
        const type = e.dataTransfer.getData('text/type') || 'CAT';

        if (type === 'WORD') {
            const word = prompt('Enter word/token:', label || '');
            if (!word || !word.trim()) return;
            label = word.trim();
        }

        if (!label) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const node = this.model.createNode(label, x, y, type);
        this.render();
    }

    // NODE SELECTION & INTERACTION

    onCanvasClick(e) {
        // Only clear selection if clicking on empty canvas
        if (e.target === this.canvas) {
            this.ui.clearSelection();
            this.updateUI();
            this.render();
        }
    }

    onSVGClick(e) {
        if (e.target.tagName === 'line') {
            const edgeId = e.target.dataset.edgeId;
            this.ui.selectEdge(edgeId);
            this.updateUI();
            this.render();
        }
    }

    onNodePointerDown(e) {
        const nodeEl = e.target.closest('.node');
        if (!nodeEl) return;

        e.preventDefault();
        const nodeId = nodeEl.dataset.nodeId;

        if (this.ui.addDescendentMode) {
            // In add descendent mode: click on node makes it the child
            this.connectDescendent(nodeId);
            return;
        }

        // Select the node
        this.ui.selectNode(nodeId);
        this.updateUI();
        this.render();

        // Prepare drag with pointer capture
        this.draggedNode = nodeId;
        this.draggedElement = nodeEl;

        // Store initial pointer position relative to canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasWrapper = this.canvas.parentElement;
        const nodeRect = nodeEl.getBoundingClientRect();

        // Account for canvas scroll position
        this.dragInitialX = e.clientX - canvasRect.left + canvasWrapper.scrollLeft;
        this.dragInitialY = e.clientY - canvasRect.top + canvasWrapper.scrollTop;

        const node = this.model.nodes.find(n => n.id === nodeId);
        this.dragNodeStartX = node.x;
        this.dragNodeStartY = node.y;

        // Capture pointer to this element
        nodeEl.setPointerCapture(e.pointerId);
    }

    onNodePointerMove(e) {
        if (!this.draggedNode || !this.draggedElement) return;

        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasWrapper = this.canvas.parentElement;

        // Current pointer position relative to canvas (accounting for scroll)
        const currentX = e.clientX - canvasRect.left + canvasWrapper.scrollLeft;
        const currentY = e.clientY - canvasRect.top + canvasWrapper.scrollTop;

        // Calculate delta from initial position
        const deltaX = currentX - this.dragInitialX;
        const deltaY = currentY - this.dragInitialY;

        // Calculate new position
        const x = Math.max(0, this.dragNodeStartX + deltaX);
        const y = Math.max(0, this.dragNodeStartY + deltaY);

        const node = this.model.nodes.find(n => n.id === this.draggedNode);
        if (node) {
            node.x = x;
            node.y = y;
            this.render();
        }
    }

    onNodePointerUp(e) {
        if (this.draggedElement) {
            this.draggedElement.releasePointerCapture(e.pointerId);
        }
        this.draggedNode = null;
        this.draggedElement = null;
    }

    onNodeDoubleClick(e) {
        const nodeEl = e.target.closest('.node');
        if (!nodeEl) return;

        const nodeId = nodeEl.dataset.nodeId;
        const node = this.model.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const newLabel = prompt('Edit node label (format: "Label" or "Label leaftext"):', node.label);
        if (newLabel !== null && newLabel.trim()) {
            node.label = newLabel.trim();
            this.render();
        }
    }

    // ADD DESCENDENT WORKFLOW

    onAddDescendentClick() {
        if (this.ui.addDescendentMode) {
            // Already in mode, cancel
            this.ui.exitAddDescendentMode();
            this.addDescendentBtn.classList.remove('active');
            this.updateUI();
            this.render();
            return;
        }

        if (!this.ui.selectedNode) {
            alert('Please select a parent node first.');
            return;
        }

        this.ui.enterAddDescendentMode(this.ui.selectedNode);
        this.addDescendentBtn.classList.add('active');
    }

    connectDescendent(childId) {
        const parentId = this.ui.addDescendentParentId;

        // Prevent cycles
        if (this.model.isAncestor(childId, parentId)) {
            alert('Cannot create a cycle: the selected node is already an ancestor.');
            return;
        }

        // Check if child already has a parent -> re-parent
        const existingParent = this.model.getParentOf(childId);
        if (existingParent) {
            const edge = this.model.findEdgeByNodeIds(existingParent.id, childId);
            if (edge) {
                this.model.deleteEdge(edge.id);
            }
        }

        // Create new edge
        this.model.createEdge(parentId, childId);

        // Exit mode
        this.ui.exitAddDescendentMode();
        this.addDescendentBtn.classList.remove('active');
        this.ui.clearSelection();
        this.updateUI();
        this.render();
    }

    // DELETE FUNCTIONALITY

    onResetClick() {
        // Remove only dynamically created custom blocks
        const customBlocks = document.querySelectorAll('.block.user-custom');
        customBlocks.forEach(block => block.remove());
    }

    onDeleteClick() {
        if (this.ui.selectedNode) {
            this.model.deleteNode(this.ui.selectedNode);
            this.ui.clearSelection();
        } else if (this.ui.selectedEdge) {
            this.model.deleteEdge(this.ui.selectedEdge);
            this.ui.clearSelection();
        }
        this.updateUI();
        this.render();
    }

    onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.ui.selectedNode || this.ui.selectedEdge) {
                this.onDeleteClick();
            }
        }
    }

    // AUTO-LAYOUT

    onAutoLayoutClick() {
        if (this.model.nodes.length === 0) {
            alert('No nodes to layout.');
            return;
        }

        this.autoLayout();
        this.render();
    }

    autoLayout() {
        const roots = this.model.getRoots();
        if (roots.length === 0) return;

        const nodePositions = {};
        let y = 80;
        const levelWidth = 150;
        const verticalGap = 100;

        // Layout each tree
        roots.forEach((root, rootIdx) => {
            const xOffset = 100 + rootIdx * (this.canvas.offsetWidth / (roots.length + 1));
            this.layoutSubtree(root, nodePositions, 0, xOffset, y);
        });

        // Apply positions
        this.model.nodes.forEach(node => {
            if (nodePositions[node.id]) {
                const pos = nodePositions[node.id];
                node.x = pos.x;
                node.y = pos.y;
            }
        });

        this.centerNodesInCanvas();
    }

    layoutSubtree(node, positions, depth, xOffset, yOffset) {
        const children = this.model.getChildrenOf(node.id);
        const y = yOffset + depth * 100;
        const childCount = children.length;

        if (childCount === 0) {
            // Leaf node
            positions[node.id] = { x: xOffset, y: y };
        } else {
            // Non-leaf: center between children
            const childWidth = 150;
            const totalChildWidth = childCount * childWidth;
            const startX = xOffset - totalChildWidth / 2;

            children.forEach((child, idx) => {
                const childX = startX + idx * childWidth;
                this.layoutSubtree(child, positions, depth + 1, childX, yOffset);
            });

            // Center parent above children
            positions[node.id] = { x: xOffset, y: y };
        }
    }

    centerNodesInCanvas() {
        if (this.model.nodes.length === 0) return;

        const minX = Math.min(...this.model.nodes.map(n => n.x));
        const minY = Math.min(...this.model.nodes.map(n => n.y));
        const maxX = Math.max(...this.model.nodes.map(n => n.x + n.width));
        const maxY = Math.max(...this.model.nodes.map(n => n.y + n.height));

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        const viewWidth = this.canvas.parentElement.clientWidth || this.canvas.clientWidth;
        const viewHeight = this.canvas.parentElement.clientHeight || this.canvas.clientHeight;

        const targetMinX = Math.max(0, (viewWidth - contentWidth) / 2);
        const targetMinY = Math.max(0, (viewHeight - contentHeight) / 2);

        const shiftX = targetMinX - minX;
        const shiftY = targetMinY - minY;

        this.model.nodes.forEach(node => {
            node.x += shiftX;
            node.y += shiftY;
        });
    }

    // CLEAR
    onClearClick() {
        if (this.model.nodes.length === 0) return;

        if (confirm('Clear all nodes and edges? This cannot be undone.')) {
            this.model.clear();
            this.ui.clearSelection();
            this.updateUI();
            this.render();
        }
    }

    // EXPORT / IMPORT
    onExportClick() {
        const roots = this.model.getRoots();
        if (roots.length === 0) {
            alert('No nodes to export.');
            return;
        }

        try {
            let notation = '';
            if (roots.length === 1) {
                notation = this.nodeToBracketNotation(roots[0]);
            } else {
                // Multiple roots: wrap in ROOT
                const rootNotations = roots
                    .sort((a, b) => a.x - b.x)
                    .map(root => this.nodeToBracketNotation(root))
                    .join(' ');
                notation = `[ROOT ${rootNotations}]`;
            }

            // Copy to clipboard and show in alert
            const textarea = document.createElement('textarea');
            textarea.value = notation;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            alert(`Exported to clipboard:\n\n${notation}`);
        } catch (error) {
            alert(`Export failed: ${error.message}`);
        }
    }

    nodeToBracketNotation(node) {
        if (node.type === 'WORD') {
            return node.label;
        }

        const children = this.model.getChildrenOf(node.id).sort((a, b) => a.x - b.x);
        const childNotations = children.map(child => this.nodeToBracketNotation(child)).filter(Boolean);
        const inside = childNotations.join(' ');
        return inside ? `[${node.label} ${inside}]` : `[${node.label}]`;
    }

    onImportClick() {
        const notation = prompt('Paste bracket notation to import:', '');
        if (!notation) return;

        try {
            const parser = new BracketNotationParser();
            const rootStructure = parser.parse(notation.trim());

            // Clear existing tree
            this.model.clear();
            this.ui.clearSelection();

            // Build tree from structure
            this.buildTreeFromStructure(rootStructure, null, 0);

            // Auto-layout
            this.autoLayout();

            this.updateUI();
            this.render();
            alert('Import successful!');
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    }

    buildTreeFromStructure(structure, parentId, depth) {
        const node = this.model.createNode(structure.label, 100 + depth * 50, 50 + depth * 100, 'CAT');

        if (parentId) {
            this.model.createEdge(parentId, node.id);
        }

        if (structure.children && structure.children.length > 0) {
            structure.children.forEach(child => {
                this.buildTreeFromStructure(child, node.id, depth + 1);
            });
        }

        if (structure.leafText && structure.leafText.length > 0) {
            const wordLabel = structure.leafText.join(' ');
            const wordNode = this.model.createNode(wordLabel, 100 + (depth + 1) * 50, 50 + (depth + 1) * 100, 'WORD');
            this.model.createEdge(node.id, wordNode.id);
        }

        return node;
    }

    // RENDERING

    updateUI() {
        // Update button active states
        if (this.ui.addDescendentMode) {
            this.addDescendentBtn.classList.add('active');
        } else {
            this.addDescendentBtn.classList.remove('active');
        }
    }

    render() {
        // Clear canvas and SVG
        this.canvas.innerHTML = '';
        this.svg.innerHTML = '';

        // Draw edges first
        this.model.edges.forEach(edge => {
            this.drawEdge(edge);
        });

        // Draw nodes
        this.model.nodes.forEach(node => {
            this.drawNode(node);
        });
    }

    drawNode(node) {
        const div = document.createElement('div');
        div.className = 'node';
        div.dataset.nodeId = node.id;
        div.textContent = node.label;
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';
        div.style.width = node.width + 'px';
        div.style.minHeight = node.height + 'px';

        if (node.type === 'WORD') {
            div.classList.add('word');
        }

        if (this.ui.selectedNode === node.id) {
            div.classList.add('selected');
        }

        if (this.ui.addDescendentMode && this.ui.addDescendentParentId === node.id) {
            div.classList.add('add-descendent-parent');
        }

        div.draggable = true;
        this.canvas.appendChild(div);
    }

    drawEdge(edge) {
        const parentNode = this.model.nodes.find(n => n.id === edge.parentId);
        const childNode = this.model.nodes.find(n => n.id === edge.childId);

        if (!parentNode || !childNode) return;

        // Calculate connection points (center bottom of parent to center top of child)
        const x1 = parentNode.x + parentNode.width / 2;
        const y1 = parentNode.y + parentNode.height;
        const x2 = childNode.x + childNode.width / 2;
        const y2 = childNode.y;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('data-edge-id', edge.id);

        if (this.ui.selectedEdge === edge.id) {
            line.classList.add('selected');
        }

        this.svg.appendChild(line);
    }
}

// BRACKET NOTATION PARSER

class BracketNotationParser {
    parse(notation) {
        const tokens = this.tokenize(notation);
        const [structure, remaining] = this.parseExpression(tokens, 0);

        if (remaining.length > 0) {
            throw new Error('Unexpected tokens after root expression.');
        }

        return structure;
    }

    tokenize(notation) {
        const tokens = [];
        let i = 0;

        while (i < notation.length) {
            const char = notation[i];

            if (char === '[' || char === ']') {
                tokens.push(char);
                i++;
            } else if (/\s/.test(char)) {
                i++;
            } else {
                // Read a token until whitespace or bracket
                let token = '';
                while (i < notation.length && !/[\s\[\]]/.test(notation[i])) {
                    token += notation[i];
                    i++;
                }
                if (token) tokens.push(token);
            }
        }

        return tokens;
    }

    parseExpression(tokens, pos) {
        if (pos >= tokens.length || tokens[pos] !== '[') {
            throw new Error(`Expected '[' at position ${pos}.`);
        }

        pos++; // skip '['

        if (pos >= tokens.length) {
            throw new Error('Unexpected end of input: expected label.');
        }

        const label = tokens[pos];
        pos++;

        const children = [];
        const leafText = [];

        // Parse children and/or leaf tokens
        while (pos < tokens.length && tokens[pos] !== ']') {
            if (tokens[pos] === '[') {
                // Parse child expression
                const [childStructure, newPos] = this.parseExpression(tokens, pos);
                children.push(childStructure);
                pos = newPos;
            } else {
                // Leaf token
                leafText.push(tokens[pos]);
                pos++;
            }
        }

        if (pos >= tokens.length || tokens[pos] !== ']') {
            throw new Error(`Expected ']' at position ${pos}.`);
        }

        pos++; // skip ']'

        return [
            {
                label: label,
                children: children.length > 0 ? children : null,
                leafText: leafText.length > 0 ? leafText : null
            },
            pos
        ];
    }
}

// INITIALIZE APP

document.addEventListener('DOMContentLoaded', () => {
    const app = new TreeApp();
});
