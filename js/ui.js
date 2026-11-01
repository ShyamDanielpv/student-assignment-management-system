/**
 * UI.JS - User Interface Utilities
 * Helpers for modals, toasts, badge generation, and date formatting.
 */

const UI = {
  /**
   * Escape HTML to prevent injection
   */
  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /**
   * Display toast notification
   */
  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: "✅",
      warning: "⚠️",
      danger: "❌",
      info: "ℹ️"
    };

    toast.innerHTML = `
      <span>${icons[type] || "ℹ️"} ${this.escapeHtml(message)}</span>
      <button style="background:none;border:none;cursor:pointer;color:inherit;font-weight:bold;margin-left:0.5rem;" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  /**
   * Open modal dialog
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },

  /**
   * Close modal dialog
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  },

  /**
   * Human-friendly date formatting
   */
  formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  },

  /**
   * Check if a due date has passed
   */
  isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
  },

  /**
   * Generates a status badge for the 4 core statuses:
   * Pending, Submitted, Reviewed, Late
   */
  getStatusBadge(status) {
    const s = (status || "Pending").toLowerCase();

    if (s === "reviewed" || s === "graded") {
      return `<span class="badge badge-reviewed">✅ Reviewed</span>`;
    }
    if (s === "submitted") {
      return `<span class="badge badge-submitted">📬 Submitted</span>`;
    }
    if (s === "late") {
      return `<span class="badge badge-late">⚠️ Late</span>`;
    }
    // Default Pending
    return `<span class="badge badge-pending">⏳ Pending</span>`;
  }
};
