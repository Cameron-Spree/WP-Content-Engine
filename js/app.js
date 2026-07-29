/**
 * WP Content Engine - Main Application Controller
 * Handles state management, UI rendering, event dispatching, and browser persistence.
 */

import { SAMPLE_IMAGE_POOL, SAMPLE_POST_PAYLOADS } from "./utils/sampleData.js";
import { generateAIPrompt } from "./utils/promptTemplates.js";
import { parseAndValidateJSON } from "./utils/jsonValidator.js";
import { autoMatchPostMedia, replaceImagePlaceholdersInHtml } from "./utils/mediaMatcher.js";
import { calculateBatchSchedule, parseFormattedDateToInput, formatInputToFormattedDate, formatDateFormatted } from "./utils/scheduler.js";
import { generateWXRXML } from "./utils/xmlGenerator.js";

// Storage Key
const STORAGE_KEY = "wp_content_engine_state_v2";

// App State
const state = {
  posts: [],
  imagePool: [],
  activeTab: "tab-prompt",
  scheduleConfig: {
    startDateStr: new Date().toISOString().split("T")[0],
    startTimeStr: "09:00",
    intervalNum: 3,
    intervalUnit: "days"
  }
};

// Initialize App on DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
  loadStoredState();
  initTabNavigation();
  initPromptGenerator();
  initIngestionAndMedia();
  initQueueAndScheduler();
  initXmlExport();
  initGlobalHeaderActions();
  initModals();
  
  // Render Initial View
  renderAll();
});

/* ==========================================================================
   STATE PERSISTENCE & SAMPLE DATA
   ========================================================================== */

function loadStoredState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.posts = parsed.posts || [];
      state.imagePool = parsed.imagePool || [];
      if (parsed.scheduleConfig) state.scheduleConfig = parsed.scheduleConfig;
    } catch (e) {
      console.warn("Failed to load stored state:", e);
    }
  }

  // If initial state is completely empty, populate sample media pool for instant usability
  if (state.imagePool.length === 0) {
    state.imagePool = [...SAMPLE_IMAGE_POOL];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    posts: state.posts,
    imagePool: state.imagePool,
    scheduleConfig: state.scheduleConfig
  }));
  updateHeaderStats();
}

/* ==========================================================================
   NAVIGATION & TABS
   ========================================================================== */

function initTabNavigation() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
  });

  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === tabId);
  });

  // Re-render export panel when switching to export tab
  if (tabId === "tab-export") {
    renderXmlExport();
  }

  refreshLucideIcons();
}

/* ==========================================================================
   TAB 1: AI PROMPT GENERATOR
   ========================================================================== */

function initPromptGenerator() {
  const inputs = [
    "prompt-topic", "prompt-keywords", "prompt-niche",
    "prompt-tone", "prompt-urls", "prompt-word-count", "prompt-images-count"
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updatePromptPreview);
      el.addEventListener("change", updatePromptPreview);
    }
  });

  document.getElementById("btn-copy-prompt").addEventListener("click", () => {
    const text = document.getElementById("prompt-output").value;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Prompt copied to clipboard!", "success");
    });
  });

  document.getElementById("btn-reset-prompt-form").addEventListener("click", () => {
    document.getElementById("prompt-topic").value = "The Ultimate Guide to Modern WordPress SEO in 2026";
    document.getElementById("prompt-keywords").value = "wordpress seo, content marketing, search ranking, yoast seo";
    document.getElementById("prompt-niche").value = "Digital Marketing & WordPress Development";
    document.getElementById("prompt-tone").value = "Authoritative, professional, & actionable";
    document.getElementById("prompt-urls").value = "https://mysite.com/blog/speed-optimization\nhttps://mysite.com/blog/keyword-research-guide";
    updatePromptPreview();
    showToast("Prompt generator reset to defaults.", "info");
  });

  updatePromptPreview();
}

function updatePromptPreview() {
  const params = {
    topic: document.getElementById("prompt-topic").value,
    keywords: document.getElementById("prompt-keywords").value,
    niche: document.getElementById("prompt-niche").value,
    tone: document.getElementById("prompt-tone").value,
    urls: document.getElementById("prompt-urls").value,
    wordCount: document.getElementById("prompt-word-count").value,
    imageCount: document.getElementById("prompt-images-count").value
  };

  const generated = generateAIPrompt(params);
  document.getElementById("prompt-output").value = generated;
}

/* ==========================================================================
   TAB 2: JSON INGESTION & SMART MEDIA POOL
   ========================================================================== */

function initIngestionAndMedia() {
  const rawInput = document.getElementById("raw-json-input");
  const jsonBadge = document.getElementById("json-status-badge");
  const errorBanner = document.getElementById("json-error-banner");
  const errorMsg = document.getElementById("json-error-msg");

  // Real-time live JSON validation check on typing
  rawInput.addEventListener("input", () => {
    const val = rawInput.value.trim();
    if (!val) {
      jsonBadge.className = "badge badge-neutral";
      jsonBadge.textContent = "Waiting for Input";
      errorBanner.classList.add("hidden");
      return;
    }

    const validation = parseAndValidateJSON(val);
    if (validation.valid) {
      jsonBadge.className = "badge badge-success";
      jsonBadge.textContent = `Valid JSON (${validation.count} Post${validation.count > 1 ? "s" : ""})`;
      errorBanner.classList.add("hidden");
    } else {
      jsonBadge.className = "badge badge-danger";
      jsonBadge.textContent = "Syntax Error";
      errorMsg.textContent = validation.error;
      errorBanner.classList.remove("hidden");
    }
  });

  document.getElementById("btn-clear-json").addEventListener("click", () => {
    rawInput.value = "";
    jsonBadge.className = "badge badge-neutral";
    jsonBadge.textContent = "Waiting for Input";
    errorBanner.classList.add("hidden");
  });

  document.getElementById("btn-paste-sample-json").addEventListener("click", () => {
    rawInput.value = JSON.stringify(SAMPLE_POST_PAYLOADS, null, 2);
    rawInput.dispatchEvent(new Event("input"));
    showToast("Demo JSON payload loaded into ingestion area.", "info");
  });

  document.getElementById("btn-ingest-json").addEventListener("click", () => {
    const val = rawInput.value.trim();
    const result = parseAndValidateJSON(val);

    if (!result.valid) {
      showToast(`Ingestion Failed: ${result.error}`, "error");
      return;
    }

    // Auto match posts with media pool
    const matchedPosts = result.posts.map(post => autoMatchPostMedia(post, state.imagePool));
    state.posts.push(...matchedPosts);

    saveState();
    renderAll();

    rawInput.value = "";
    rawInput.dispatchEvent(new Event("input"));

    showToast(`Successfully ingested ${matchedPosts.length} post(s) into queue!`, "success");
    switchTab("tab-queue");
  });

  document.getElementById("btn-open-add-image").addEventListener("click", () => {
    openModal("modal-add-image");
  });
}

function renderMediaPool() {
  const container = document.getElementById("media-pool-container");
  if (!container) return;

  if (state.imagePool.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder">
        <i data-lucide="image-off"></i>
        <p>No images in pool. Click "Add Image" above to populate asset pool.</p>
      </div>`;
    refreshLucideIcons();
    return;
  }

  container.innerHTML = state.imagePool.map(img => `
    <div class="media-asset-card" data-img-id="${img.id}">
      <div class="media-asset-img-wrapper">
        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'" />
      </div>
      <div class="media-asset-details">
        <div class="media-asset-title" title="${escapeHtml(img.title)}">${escapeHtml(img.title)}</div>
        <div class="tag-pills">
          ${img.tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
        </div>
        <div class="media-asset-actions">
          <span>ID: ${escapeHtml(img.id)}</span>
          <button class="btn-icon-delete btn-delete-img" data-img-id="${img.id}" title="Delete Image">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");

  // Attach delete handlers
  container.querySelectorAll(".btn-delete-img").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-img-id");
      deleteImageFromPool(id);
    });
  });

  refreshLucideIcons();
}

function deleteImageFromPool(imageId) {
  state.imagePool = state.imagePool.filter(i => i.id !== imageId);
  saveState();
  renderMediaPool();
  showToast("Image removed from asset pool.", "info");
}

/* ==========================================================================
   TAB 3: POST QUEUE & BATCH SCHEDULER
   ========================================================================== */

function initQueueAndScheduler() {
  // Set default schedule date picker to today
  const startDateInput = document.getElementById("sched-start-date");
  if (startDateInput && !startDateInput.value) {
    startDateInput.value = state.scheduleConfig.startDateStr;
  }

  document.getElementById("btn-apply-schedule").addEventListener("click", () => {
    const startDateStr = document.getElementById("sched-start-date").value;
    const startTimeStr = document.getElementById("sched-start-time").value;
    const intervalNum = document.getElementById("sched-interval-num").value;
    const intervalUnit = document.getElementById("sched-interval-unit").value;

    state.scheduleConfig = { startDateStr, startTimeStr, intervalNum, intervalUnit };

    if (state.posts.length === 0) {
      showToast("No posts in queue to schedule.", "warning");
      return;
    }

    state.posts = calculateBatchSchedule(state.posts, state.scheduleConfig);
    saveState();
    renderQueuePosts();
    showToast(`Batch schedule calculated for ${state.posts.length} post(s)!`, "success");
  });

  document.getElementById("btn-clear-queue").addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all queued posts?")) {
      state.posts = [];
      saveState();
      renderAll();
      showToast("Post queue cleared.", "info");
    }
  });
}

function renderQueuePosts() {
  const container = document.getElementById("queue-posts-container");
  if (!container) return;

  if (state.posts.length === 0) {
    container.innerHTML = `
      <div class="card empty-card" style="text-align: center; padding: 48px;">
        <i data-lucide="file-x-2" style="width: 48px; height: 48px; color: var(--text-dim); margin-bottom: 12px;"></i>
        <h3>Queue is Empty</h3>
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Import JSON from Tab 2 or click "Load Sample Data" in top header to start.</p>
      </div>`;
    refreshLucideIcons();
    return;
  }

  container.innerHTML = state.posts.map((post, idx) => {
    const featuredImgUrl = post.featured_image ? post.featured_image.url : "https://via.placeholder.com/150?text=No+Image";
    const statusBadgeClass = post.status === "future" ? "badge-warning" : "badge-success";
    const statusLabel = post.status === "future" ? "Scheduled" : "Publish";

    return `
    <div class="post-queue-card" data-post-id="${post.id}">
      <div class="queue-card-left">
        <img src="${escapeHtml(featuredImgUrl)}" alt="${escapeHtml(post.title)}" class="queue-post-thumb" onerror="this.src='https://via.placeholder.com/150?text=No+Image'" />
        <div class="queue-post-info">
          <h4>#${idx + 1}. ${escapeHtml(post.title)}</h4>
          <div class="queue-post-slug">/${escapeHtml(post.slug)}</div>
          <div class="queue-meta-row">
            <span class="badge ${statusBadgeClass}">${statusLabel}</span>
            <span style="color: var(--text-muted);">Cats: ${escapeHtml((post.categories || []).join(", "))}</span>
            <span style="color: var(--text-dim);">|</span>
            <span style="color: var(--text-muted);">Placeholders: ${post.image_placeholders ? post.image_placeholders.length : 0}</span>
          </div>
        </div>
      </div>

      <div class="queue-card-right">
        <div class="queue-schedule-info">
          <span style="font-size: 11px; color: var(--text-dim);">Post Date:</span>
          <span class="queue-date-badge">${escapeHtml(post.post_date || "Not Scheduled")}</span>
        </div>
        <div class="queue-card-actions">
          <button class="btn btn-secondary btn-sm btn-preview-post" data-post-id="${post.id}" title="Live HTML Preview">
            <i data-lucide="eye"></i> Preview
          </button>
          <button class="btn btn-outline btn-sm btn-edit-post" data-post-id="${post.id}" title="Edit Post">
            <i data-lucide="edit-3"></i> Edit
          </button>
          <button class="btn-icon-delete btn-delete-post" data-post-id="${post.id}" title="Delete Post">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join("");

  // Attach card event listeners
  container.querySelectorAll(".btn-preview-post").forEach(btn => {
    btn.addEventListener("click", () => openPostPreview(btn.getAttribute("data-post-id")));
  });

  container.querySelectorAll(".btn-edit-post").forEach(btn => {
    btn.addEventListener("click", () => openPostEdit(btn.getAttribute("data-post-id")));
  });

  container.querySelectorAll(".btn-delete-post").forEach(btn => {
    btn.addEventListener("click", () => deletePost(btn.getAttribute("data-post-id")));
  });

  refreshLucideIcons();
}

function deletePost(postId) {
  state.posts = state.posts.filter(p => p.id !== postId);
  saveState();
  renderAll();
  showToast("Post removed from queue.", "info");
}

/* ==========================================================================
   TAB 4: WXR XML EXPORT ENGINE
   ========================================================================== */

function initXmlExport() {
  document.getElementById("btn-copy-xml").addEventListener("click", () => {
    const xml = document.getElementById("xml-output-textarea").value;
    if (!xml) return;
    navigator.clipboard.writeText(xml).then(() => {
      showToast("WXR XML code copied to clipboard!", "success");
    });
  });

  document.getElementById("btn-download-xml").addEventListener("click", triggerXmlDownload);
}

function renderXmlExport() {
  const textarea = document.getElementById("xml-output-textarea");
  const postsCountEl = document.getElementById("xml-stat-posts");
  const attachmentsCountEl = document.getElementById("xml-stat-attachments");
  const yoastStatEl = document.getElementById("xml-stat-yoast");

  if (!textarea) return;

  if (state.posts.length === 0) {
    textarea.value = `<!-- No posts in queue to generate WXR XML. Ingest posts in Tab 2 first. -->`;
    postsCountEl.textContent = "0 Posts";
    attachmentsCountEl.textContent = "0 Attachments";
    yoastStatEl.textContent = "0% Configured";
    return;
  }

  // Auto ensure media mapping for all posts before XML build
  const updatedPosts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool));
  state.posts = updatedPosts;

  const xmlContent = generateWXRXML(state.posts, state.imagePool);
  textarea.value = xmlContent;

  // Calculate stats
  postsCountEl.textContent = `${state.posts.length} Post${state.posts.length > 1 ? "s" : ""}`;
  
  // Count attachments
  const attachmentUrls = new Set();
  state.posts.forEach(p => {
    if (p.featured_image && p.featured_image.url) attachmentUrls.add(p.featured_image.url);
    if (p.mapped_images) {
      Object.values(p.mapped_images).forEach(img => { if (img && img.url) attachmentUrls.add(img.url); });
    }
  });

  attachmentsCountEl.textContent = `${attachmentUrls.size} Attachment${attachmentUrls.size > 1 ? "s" : ""}`;
  yoastStatEl.textContent = "100% Configured";
}

function triggerXmlDownload() {
  if (state.posts.length === 0) {
    showToast("No posts in queue to export. Please ingest posts first.", "error");
    return;
  }

  const xmlContent = generateWXRXML(state.posts, state.imagePool);
  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `wordpress-posts-export-${dateStr}.xml`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename} successfully!`, "success");
}

/* ==========================================================================
   MODALS: PREVIEW & EDIT
   ========================================================================== */

function initModals() {
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  // Modal backdrop click to close
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  });

  // Save Post Edit Button
  document.getElementById("btn-save-edit-post").addEventListener("click", savePostEdit);

  // Save New Image Button
  document.getElementById("btn-save-new-image").addEventListener("click", saveNewImage);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    refreshLucideIcons();
  }
}

function closeModal() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
}

function openPostPreview(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  document.getElementById("preview-modal-title").textContent = post.title;
  document.getElementById("preview-modal-slug").textContent = `/${post.slug}`;

  // Yoast SEO Specs
  document.getElementById("preview-seo-title").textContent = post.yoast_meta_title || post.title;
  document.getElementById("preview-seo-title-count").textContent = `${(post.yoast_meta_title || "").length}/60`;

  document.getElementById("preview-seo-desc").textContent = post.yoast_meta_desc || "No description set";
  document.getElementById("preview-seo-desc-count").textContent = `${(post.yoast_meta_desc || "").length}/155`;

  // Taxonomies
  document.getElementById("preview-categories").innerHTML = (post.categories || [])
    .map(c => `<span class="badge badge-info"><i data-lucide="folder"></i> ${escapeHtml(c)}</span>`).join("");
  
  document.getElementById("preview-tags").innerHTML = (post.tags || [])
    .map(t => `<span class="badge badge-neutral">#${escapeHtml(t)}</span>`).join("");

  // Featured Image
  const featBox = document.getElementById("preview-featured-box");
  if (post.featured_image && post.featured_image.url) {
    featBox.innerHTML = `<img src="${escapeHtml(post.featured_image.url)}" alt="${escapeHtml(post.title)}" />`;
  } else {
    featBox.innerHTML = "";
  }

  // Render HTML content with images replaced
  const renderedHtml = replaceImagePlaceholdersInHtml(post.content_html, post.mapped_images, state.imagePool);
  document.getElementById("preview-html-content").innerHTML = renderedHtml;

  openModal("modal-preview");
}

function openPostEdit(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  document.getElementById("edit-post-id").value = post.id;
  document.getElementById("edit-post-title").value = post.title;
  document.getElementById("edit-post-slug").value = post.slug;
  document.getElementById("edit-post-status").value = post.status || "publish";
  document.getElementById("edit-post-categories").value = (post.categories || []).join(", ");
  document.getElementById("edit-post-tags").value = (post.tags || []).join(", ");
  document.getElementById("edit-yoast-title").value = post.yoast_meta_title || "";
  document.getElementById("edit-yoast-desc").value = post.yoast_meta_desc || "";
  document.getElementById("edit-post-date").value = parseFormattedDateToInput(post.post_date);
  document.getElementById("edit-post-content").value = post.content_html;

  openModal("modal-edit");
}

function savePostEdit() {
  const postId = document.getElementById("edit-post-id").value;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  post.title = document.getElementById("edit-post-title").value.trim();
  post.slug = document.getElementById("edit-post-slug").value.trim();
  post.status = document.getElementById("edit-post-status").value;
  post.categories = document.getElementById("edit-post-categories").value.split(",").map(s => s.trim()).filter(Boolean);
  post.tags = document.getElementById("edit-post-tags").value.split(",").map(s => s.trim()).filter(Boolean);
  post.yoast_meta_title = document.getElementById("edit-yoast-title").value.trim();
  post.yoast_meta_desc = document.getElementById("edit-yoast-desc").value.trim();
  post.post_date = formatInputToFormattedDate(document.getElementById("edit-post-date").value);
  post.content_html = document.getElementById("edit-post-content").value;

  // Re-run media auto-matching for edited content
  const updatedPost = autoMatchPostMedia(post, state.imagePool);
  const index = state.posts.findIndex(p => p.id === postId);
  state.posts[index] = updatedPost;

  saveState();
  renderAll();
  closeModal();
  showToast("Post changes saved successfully!", "success");
}

function saveNewImage() {
  const url = document.getElementById("image-url").value.trim();
  const title = document.getElementById("image-title").value.trim() || "Untitled Image Asset";
  const tagsStr = document.getElementById("image-tags").value.trim();

  if (!url || !tagsStr) {
    showToast("Please provide both Image URL and keyword tags.", "error");
    return;
  }

  const newImg = {
    id: "img_" + Date.now(),
    url: url,
    title: title,
    tags: tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
  };

  state.imagePool.push(newImg);
  
  // Re-run auto match across all posts
  state.posts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool));

  saveState();
  renderAll();
  closeModal();

  // Reset Form
  document.getElementById("image-url").value = "";
  document.getElementById("image-title").value = "";
  document.getElementById("image-tags").value = "";

  showToast("Image added to pool and auto-matched to post placeholders!", "success");
}

/* ==========================================================================
   HEADER ACTIONS & RENDERING
   ========================================================================== */

function initGlobalHeaderActions() {
  document.getElementById("btn-load-sample").addEventListener("click", () => {
    state.imagePool = [...SAMPLE_IMAGE_POOL];
    const parsed = parseAndValidateJSON(JSON.stringify(SAMPLE_POST_PAYLOADS));
    if (parsed.valid) {
      state.posts = parsed.posts.map(post => autoMatchPostMedia(post, state.imagePool));
      state.posts = calculateBatchSchedule(state.posts, state.scheduleConfig);
    }

    saveState();
    renderAll();
    showToast("Sample data loaded! Posts and images are ready to test.", "success");
    switchTab("tab-queue");
  });

  document.getElementById("btn-quick-export").addEventListener("click", () => {
    switchTab("tab-export");
    triggerXmlDownload();
  });
}

function renderAll() {
  renderMediaPool();
  renderQueuePosts();
  updateHeaderStats();
  if (state.activeTab === "tab-export") {
    renderXmlExport();
  }
}

function updateHeaderStats() {
  document.getElementById("count-total").textContent = state.posts.length;
  document.getElementById("count-scheduled").textContent = state.posts.filter(p => p.status === "future").length;
  document.getElementById("count-media").textContent = state.imagePool.length;
  document.getElementById("count-ready").textContent = state.posts.length;

  document.getElementById("badge-ingest-count").textContent = state.posts.length;
  document.getElementById("badge-queue-count").textContent = state.posts.length;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  if (type === "error") iconName = "alert-triangle";

  toast.innerHTML = `<i data-lucide="${iconName}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  refreshLucideIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
