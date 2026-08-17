export class CustomControlsManager {
  private isEditMode: boolean = false;
  public onExitEditMode: (() => void) | null = null;
  private joystickZone: HTMLElement | null;
  private actionZone: HTMLElement | null;
  private editLayoutBtn: HTMLElement | null;
  
  // Drag state
  private activeDragElement: HTMLElement | null = null;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor() {
    this.joystickZone = document.getElementById("joystick-zone");
    this.actionZone = document.getElementById("action-zone");
    this.editLayoutBtn = document.getElementById("edit-layout-btn");

    if (this.editLayoutBtn) {
      this.editLayoutBtn.addEventListener("click", () => this.toggleEditMode());
      this.editLayoutBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.toggleEditMode();
      });
    }

    this.loadLayout();
    this.setupDraggable(this.joystickZone, "joystickPos");
    this.setupDraggable(this.actionZone, "actionZonePos");
  }

  public toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    
    if (this.isEditMode) {
      document.body.classList.add("edit-layout-mode");
      if (this.editLayoutBtn) this.editLayoutBtn.textContent = "SAVE LAYOUT";
      if (this.joystickZone) this.joystickZone.classList.add("draggable-active");
      if (this.actionZone) this.actionZone.classList.add("draggable-active");
    } else {
      document.body.classList.remove("edit-layout-mode");
      if (this.editLayoutBtn) this.editLayoutBtn.textContent = "EDIT LAYOUT";
      if (this.joystickZone) this.joystickZone.classList.remove("draggable-active");
      if (this.actionZone) this.actionZone.classList.remove("draggable-active");
      
      if (this.onExitEditMode) {
        this.onExitEditMode();
      }
    }
  }

  private setupDraggable(element: HTMLElement | null, storageKey: string) {
    if (!element) return;

    const startDrag = (clientX: number, clientY: number) => {
      if (!this.isEditMode) return;
      this.activeDragElement = element;
      const rect = element.getBoundingClientRect();
      this.offsetX = clientX - rect.left;
      this.offsetY = clientY - rect.top;
      
      // Temporarily disable transition for smooth dragging
      element.style.transition = "none";
    };

    const doDrag = (clientX: number, clientY: number) => {
      if (!this.isEditMode || this.activeDragElement !== element) return;
      
      // Calculate new position
      let newX = clientX - this.offsetX;
      let newY = clientY - this.offsetY;
      
      // Keep within bounds
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
      element.style.bottom = "auto";
      element.style.right = "auto";
      element.style.transform = "none";
    };

    const endDrag = () => {
      if (!this.isEditMode || this.activeDragElement !== element) return;
      this.activeDragElement = null;
      element.style.transition = ""; // Restore transitions
      
      // Save position to localStorage
      const pos = {
        left: element.style.left,
        top: element.style.top,
        bottom: element.style.bottom,
        right: element.style.right,
        transform: element.style.transform
      };
      localStorage.setItem(storageKey, JSON.stringify(pos));
    };

    // Touch Events
    element.addEventListener("touchstart", (e) => {
      if (this.isEditMode) e.preventDefault(); // Prevent accidental scroll/zoom
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    
    window.addEventListener("touchmove", (e) => {
      if (this.activeDragElement === element) {
        if (this.isEditMode) e.preventDefault();
        doDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    
    window.addEventListener("touchend", endDrag);

    // Mouse Events for desktop testing
    element.addEventListener("mousedown", (e) => {
      startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener("mousemove", (e) => {
      if (this.activeDragElement === element) {
        doDrag(e.clientX, e.clientY);
      }
    });
    
    window.addEventListener("mouseup", endDrag);
  }

  private loadLayout() {
    const applyPos = (element: HTMLElement | null, storageKey: string) => {
      if (!element) return;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const pos = JSON.parse(saved);
          if (pos.left) element.style.left = pos.left;
          if (pos.top) element.style.top = pos.top;
          if (pos.bottom) element.style.bottom = pos.bottom;
          if (pos.right) element.style.right = pos.right;
          if (pos.transform) element.style.transform = pos.transform;
        } catch (e) {
          console.error("Failed to parse saved layout", e);
        }
      }
    };

    applyPos(this.joystickZone, "joystickPos");
    applyPos(this.actionZone, "actionZonePos");
  }
}
