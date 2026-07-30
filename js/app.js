/**
 * WP Content Engine - Main Application Controller
 * Briants of Risborough Edition - Auto Links Bank, HTML Widgets, Image Upload & Path Generator
 */

import { DEFAULT_SITE_SETTINGS, SAMPLE_IMAGE_POOL, SAMPLE_POST_PAYLOADS } from "./utils/sampleData.js";
import { generateAIPrompt } from "./utils/promptTemplates.js";
import { parseAndValidateJSON } from "./utils/jsonValidator.js";
import { autoMatchPostMedia, replaceImagePlaceholdersInHtml, buildWpUploadUrl, slugifyFilename } from "./utils/mediaMatcher.js";
import { calculateBatchSchedule, parseFormattedDateToInput, formatInputToFormattedDate } from "./utils/scheduler.js";
import { generateWXRXML } from "./utils/xmlGenerator.js";
import { uploadImageToWordPress, updateWordPressMediaDetails } from "./utils/wpApiSync.js";
import { getDiagnosticReport } from "./utils/debugLogger.js";

// Storage Key
const STORAGE_KEY = "wp_content_engine_state_v3";

// App State
const state = {
  settings: { ...DEFAULT_SITE_SETTINGS },
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

// Re-render icons once Lucide finishes loading dynamically
window.addEventListener("libs-ready", () => {
  refreshLucideIcons();
});

/* ==========================================================================
   STATE PERSISTENCE
   ========================================================================== */

function loadStoredState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.settings) {
        state.settings = { ...DEFAULT_SITE_SETTINGS, ...parsed.settings };
      }
      state.posts = parsed.posts || [];
      state.imagePool = parsed.imagePool || [];
      if (parsed.scheduleConfig) state.scheduleConfig = parsed.scheduleConfig;
    } catch (e) {
      console.warn("Failed to load stored state:", e);
    }
  }

  // Keep imagePool as user state (do not auto-inject sample images)
  if (!state.imagePool) {
    state.imagePool = [];
  }
}

function saveState() {
  try {
    // Strip fileData base64 if it's too large (>300KB) to prevent localStorage QuotaExceededError
    const savableImagePool = state.imagePool.map(img => {
      if (img.fileData && img.fileData.length > 300000) {
        const { fileData, ...rest } = img;
        return rest;
      }
      return img;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings: state.settings,
      posts: state.posts,
      imagePool: savableImagePool,
      scheduleConfig: state.scheduleConfig
    }));
  } catch (err) {
    console.warn("localStorage quota reached, saving state without base64 previews...", err);
    try {
      const minimalPool = state.imagePool.map(({ fileData, previewUrl, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        settings: state.settings,
        posts: state.posts,
        imagePool: minimalPool,
        scheduleConfig: state.scheduleConfig
      }));
    } catch (err2) {
      console.warn("Could not save state to localStorage", err2);
    }
  }
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

  if (tabId === "tab-prompt") {
    updatePromptPreview();
  } else if (tabId === "tab-export") {
    renderXmlExport();
  }

  refreshLucideIcons();
}

/* ==========================================================================
   TAB 1: AI PROMPT GENERATOR & BULK TOPICAL CLUSTERS
   ========================================================================== */

let currentPromptMode = "single";

function initPromptGenerator() {
  const btnSingle = document.getElementById("btn-mode-single");
  const btnBulk = document.getElementById("btn-mode-bulk");
  const viewSingle = document.getElementById("view-mode-single");
  const viewBulk = document.getElementById("view-mode-bulk");

  if (btnSingle && btnBulk) {
    btnSingle.addEventListener("click", () => {
      currentPromptMode = "single";
      btnSingle.className = "btn btn-primary";
      btnBulk.className = "btn btn-outline";
      if (viewSingle) viewSingle.classList.remove("hidden");
      if (viewBulk) viewBulk.classList.add("hidden");
      updatePromptPreview();
    });

    btnBulk.addEventListener("click", () => {
      currentPromptMode = "bulk";
      btnBulk.className = "btn btn-primary";
      btnSingle.className = "btn btn-outline";
      if (viewBulk) viewBulk.classList.remove("hidden");
      if (viewSingle) viewSingle.classList.add("hidden");
      updateBulkClusterPromptPreview();
    });
  }

  const btnGenerateBulk = document.getElementById("btn-generate-bulk-cluster");
  if (btnGenerateBulk) {
    btnGenerateBulk.addEventListener("click", () => {
      updateBulkClusterPromptPreview();
      showToast("Generated cluster prompts successfully!", "success");
    });
  }

  const singleInputs = [
    "prompt-topic", "prompt-keywords", "prompt-niche",
    "prompt-tone", "prompt-word-count", "prompt-images-count",
    "toggle-widget-know-more", "toggle-widget-category-spotlight",
    "toggle-widget-table", "toggle-strict-formatting"
  ];

  singleInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updatePromptPreview);
      el.addEventListener("change", updatePromptPreview);
    }
  });

  const bulkInputs = ["bulk-cluster-topic", "bulk-questions-input", "bulk-word-count", "bulk-tone"];
  bulkInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updatePromptPreview);
      el.addEventListener("change", updatePromptPreview);
    }
  });

  document.getElementById("btn-copy-prompt").addEventListener("click", () => {
    const text = document.getElementById("prompt-output").value;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Single article prompt copied to clipboard!", "success");
    });
  });

  const btnCopyAllBulk = document.getElementById("btn-copy-all-bulk-prompts");
  if (btnCopyAllBulk) {
    btnCopyAllBulk.addEventListener("click", () => {
      const container = document.getElementById("bulk-prompts-container");
      if (!container) return;
      const textareas = container.querySelectorAll("textarea");
      const allPrompts = Array.from(textareas).map(t => t.value).join("\n\n---\n\n");
      navigator.clipboard.writeText(allPrompts).then(() => {
        showToast(`Copied all ${textareas.length} cluster prompts to clipboard!`, "success");
      });
    });
  }

  document.getElementById("btn-reset-prompt-form").addEventListener("click", () => {
    document.getElementById("prompt-topic").value = "The Complete Guide to Selecting & Maintaining STIHL Garden Machinery";
    document.getElementById("prompt-keywords").value = "stihl garden machinery, chainsaw maintenance, lawnmower service";
    document.getElementById("prompt-niche").value = "Briants of Risborough - Garden Machinery & Tools";
    document.getElementById("prompt-tone").value = "Authoritative, practical, & expert guidance";
    document.getElementById("prompt-word-count").value = "800-1200 words";
    document.getElementById("prompt-images-count").value = "0";

    updatePromptPreview();
    showToast("Prompt generator reset to defaults.", "info");
  });

  document.getElementById("btn-edit-links-bank").addEventListener("click", () => {
    openModal("modal-settings");
  });

  updatePromptPreview();
}

function updatePromptPreview() {
  if (currentPromptMode === "single") {
    updateSinglePromptPreview();
  } else {
    updateBulkClusterPromptPreview();
  }
}

function updateSinglePromptPreview() {
  const params = {
    topic: document.getElementById("prompt-topic").value,
    keywords: document.getElementById("prompt-keywords").value,
    niche: document.getElementById("prompt-niche").value,
    tone: document.getElementById("prompt-tone").value,
    wordCount: document.getElementById("prompt-word-count").value,
    imageCount: document.getElementById("prompt-images-count").value,
    linksBank: state.settings.linksBank || [],
    queuedBatchPosts: state.posts || [],
    siteDomain: state.settings.domain,
    blogSubpath: state.settings.blogSubpath,
    widgets: {
      wantToKnowMore: document.getElementById("toggle-widget-know-more") ? document.getElementById("toggle-widget-know-more").checked : true,
      categorySpotlight: document.getElementById("toggle-widget-category-spotlight") ? document.getElementById("toggle-widget-category-spotlight").checked : true,
      table: document.getElementById("toggle-widget-table") ? document.getElementById("toggle-widget-table").checked : true,
      strictFormatting: document.getElementById("toggle-strict-formatting") ? document.getElementById("toggle-strict-formatting").checked : true
    }
  };

  const generated = generateAIPrompt(params);
  document.getElementById("prompt-output").value = generated;

  const bankCount = (state.settings.linksBank || []).length;
  const postCount = (state.posts || []).length;
  document.getElementById("internal-links-status-text").textContent = 
    `Using ${bankCount} stored site links bank + ${postCount} queued batch blog post URLs for cross-linking.`;
}

function updateBulkClusterPromptPreview() {
  const clusterTopic = document.getElementById("bulk-cluster-topic").value;
  const rawQuestions = document.getElementById("bulk-questions-input").value;
  const wordCount = document.getElementById("bulk-word-count").value;
  const tone = document.getElementById("bulk-tone").value;

  const questions = rawQuestions.split("\n").map(q => q.trim()).filter(Boolean);

  const clusterPrompts = generateBulkClusterPrompts({
    clusterTopic,
    questions,
    tone,
    wordCount,
    linksBank: state.settings.linksBank || [],
    siteDomain: state.settings.domain,
    blogSubpath: state.settings.blogSubpath
  });

  const countBadge = document.getElementById("bulk-prompts-count");
  if (countBadge) countBadge.textContent = `${clusterPrompts.length} Prompts Ready`;

  const container = document.getElementById("bulk-prompts-container");
  if (!container) return;

  if (clusterPrompts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color: var(--text-muted);">
        <i data-lucide="layers" style="width:36px; height:36px; margin-bottom:8px;"></i>
        <p>Type 1 or more article titles / questions in the left panel to generate cluster prompts.</p>
      </div>`;
    refreshLucideIcons();
    return;
  }

  container.innerHTML = clusterPrompts.map(item => `
    <div class="card" style="margin-bottom: 16px; padding: 18px; border-color: var(--border-gold-medium);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <strong style="font-family: var(--font-cinzel); font-size: 13px; color: var(--accent-gold-dark);">
          #${item.index}. ${escapeHtml(item.title)}
        </strong>
        <button class="btn btn-primary btn-sm btn-copy-single-cluster" data-index="${item.index}">
          <i data-lucide="copy"></i> Copy Prompt #${item.index}
        </button>
      </div>
      <textarea class="code-textarea cluster-prompt-textarea" rows="5" readonly style="font-size: 11px;">${escapeHtml(item.prompt)}</textarea>
    </div>
  `).join("");

  container.querySelectorAll(".btn-copy-single-cluster").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10) - 1;
      const promptObj = clusterPrompts[idx];
      if (promptObj) {
        navigator.clipboard.writeText(promptObj.prompt).then(() => {
          showToast(`Copied Prompt #${promptObj.index} ("${promptObj.title.substring(0, 25)}...") to clipboard!`, "success");
        });
      }
    };
  });

  refreshLucideIcons();
}

/* ==========================================================================
   TAB 2: JSON INGESTION & SMART MEDIA POOL
   ========================================================================== */

function initIngestionAndMedia() {
  const rawInput = document.getElementById("raw-json-input");
  const jsonBadge = document.getElementById("json-status-badge");
  const errorBanner = document.getElementById("json-error-banner");
  const errorMsg = document.getElementById("json-error-msg");

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
    showToast("Briants of Risborough demo JSON loaded.", "info");
  });

  document.getElementById("btn-ingest-json").addEventListener("click", () => {
    const val = rawInput.value.trim();
    const result = parseAndValidateJSON(val);

    if (!result.valid) {
      showToast(`Ingestion Failed: ${result.error}`, "error");
      return;
    }

    const matchedPosts = result.posts.map(post => autoMatchPostMedia(post, state.imagePool, state.settings));
    state.posts.push(...matchedPosts);

    saveState();
    renderAll();

    rawInput.value = "";
    rawInput.dispatchEvent(new Event("input"));

    showToast(`Successfully ingested ${matchedPosts.length} post(s) into queue!`, "success");
    switchTab("tab-queue");
  });

  const fileInput = document.getElementById("file-upload-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      processUploadedImageFiles(e.target.files);
      fileInput.value = "";
    });
  }

  document.getElementById("btn-open-add-image").addEventListener("click", () => {
    openModal("modal-add-image");
  });

  // Media Library Tab Event Listeners
  const mediaFileInput = document.getElementById("file-upload-input-media");
  if (mediaFileInput) {
    mediaFileInput.addEventListener("change", (e) => {
      processUploadedImageFiles(e.target.files);
      mediaFileInput.value = "";
    });
  }

  // Drag and drop upload listeners for Media Library container
  const mediaContainer = document.getElementById("full-media-library-container");
  if (mediaContainer) {
    ["dragenter", "dragover"].forEach(eventName => {
      mediaContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        mediaContainer.style.border = "2px dashed var(--accent-gold-dark)";
      }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
      mediaContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        mediaContainer.style.border = "none";
      }, false);
    });

    mediaContainer.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      processUploadedImageFiles(files);
    });
  }

function processUploadedImageFiles(files) {
  const fileArray = Array.from(files).filter(f => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif|bmp|heic)$/i.test(f.name));

  if (fileArray.length === 0) {
    showToast("Please select valid image files (JPG, PNG, WEBP, etc.).", "warning");
    return;
  }

  let processedCount = 0;

  fileArray.forEach(async (file) => {
    const filename = slugifyFilename(file.name);
    let computedWpUrl = buildWpUploadUrl(filename, state.settings);
    let wpMediaId = null;

    // Check if WordPress Direct REST API credentials are configured
    if (state.settings.wpUsername && state.settings.wpAppPassword) {
      showToast(`Uploading ${file.name} directly to WordPress...`, "info");
      const wpResult = await uploadImageToWordPress(file, state.settings);
      if (wpResult && wpResult.success) {
        computedWpUrl = wpResult.url;
        wpMediaId = wpResult.wpMediaId;
        showToast(`Uploaded to WordPress! Media ID: #${wpResult.wpMediaId}`, "success");
      } else if (wpResult && wpResult.error) {
        showToast(`WP API Notice: Uploaded locally (WP response: ${wpResult.status || 'Offline'})`, "warning");
      }
    }

    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (e) {
      // fallback
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const tags = extractTagsFromFilename(filename);

      const newImg = {
        id: "img_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
        filename: filename,
        url: computedWpUrl,
        wpMediaId: wpMediaId,
        previewUrl: objectUrl || dataUrl,
        title: file.name.split(".")[0].replace(/[-_]/g, " "),
        tags: tags,
        fileData: dataUrl
      };

      state.imagePool.push(newImg);
      state.posts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool, state.settings));

      processedCount++;
      if (processedCount === fileArray.length) {
        saveState();
        renderAll();
      }
    };

    reader.onerror = (err) => {
      console.error("FileReader error for file:", file.name, err);
      showToast(`Error reading file: ${file.name}`, "error");
    };

    reader.readAsDataURL(file);
  });
}

  const btnAddImgMedia = document.getElementById("btn-open-add-image-media");
  if (btnAddImgMedia) {
    btnAddImgMedia.addEventListener("click", () => openModal("modal-add-image"));
  }

  const btnZipMedia = document.getElementById("btn-download-zip-media");
  if (btnZipMedia) {
    btnZipMedia.addEventListener("click", triggerMediaZipDownload);
  }

  const mediaSearchInput = document.getElementById("media-search-input");
  if (mediaSearchInput) {
    mediaSearchInput.addEventListener("input", renderMediaPool);
  }

  const mediaSortSelect = document.getElementById("media-sort-select");
  if (mediaSortSelect) {
    mediaSortSelect.addEventListener("change", renderMediaPool);
  }

  const btnSaveEditImage = document.getElementById("btn-save-edit-image");
  if (btnSaveEditImage) {
    btnSaveEditImage.addEventListener("click", saveImageEdit);
  }
}

function extractTagsFromFilename(filename) {
  const base = filename.split(".")[0];
  const parts = base.toLowerCase().split(/[-_\s]+/);
  const stopWords = ["the", "a", "an", "and", "or", "in", "of", "to", "for", "img", "image", "pic"];
  return [...new Set(parts.filter(p => p.length > 2 && !stopWords.includes(p)))];
}

function renderMediaPool() {
  const container = document.getElementById("media-pool-container");
  const fullContainer = document.getElementById("full-media-library-container");

  let images = [...state.imagePool];

  // Apply search filter if active
  const searchInput = document.getElementById("media-search-input");
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  if (query) {
    images = images.filter(img => 
      img.title.toLowerCase().includes(query) ||
      (img.filename && img.filename.toLowerCase().includes(query)) ||
      (img.tags && img.tags.some(t => t.toLowerCase().includes(query)))
    );
  }

  // Apply sorting
  const sortSelect = document.getElementById("media-sort-select");
  const sortBy = sortSelect ? sortSelect.value : "newest";
  if (sortBy === "title") {
    images.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "filename") {
    images.sort((a, b) => (a.filename || "").localeCompare(b.filename || ""));
  }

  const galleryCountEl = document.getElementById("media-gallery-count");
  if (galleryCountEl) galleryCountEl.textContent = `${images.length} Asset${images.length !== 1 ? "s" : ""}`;

  const renderCardHTML = (img) => {
    const displaySrc = img.previewUrl || img.url;
    return `
    <div class="media-asset-card" data-img-id="${img.id}">
      <div class="media-asset-img-wrapper">
        <img src="${escapeHtml(displaySrc)}" alt="${escapeHtml(img.title)}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<div style=\'display:flex;align-items:center;justify-content:center;height:100%;background:rgba(0,0,0,0.3);color:var(--text-muted);font-size:11px;\'>No Preview</div>'" />
      </div>
      <div class="media-asset-details">
        <div class="media-asset-title" title="${escapeHtml(img.title)}">${escapeHtml(img.title)}</div>
        <div style="font-family: var(--font-mono); font-size: 10px; color: var(--accent-gold-dark); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(img.url)}">
          ${escapeHtml(img.filename || img.url.split('/').pop())}
        </div>
        <div class="tag-pills">
          ${img.tags.map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}
        </div>
        <div class="media-asset-actions">
          <button class="btn btn-outline btn-sm btn-edit-img" data-img-id="${img.id}" title="Edit / Rename Image">
            <i data-lucide="edit-2"></i> Rename / Edit
          </button>
          <button class="btn-icon-delete btn-delete-img" data-img-id="${img.id}" title="Delete Image">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>`;
  };

  const emptyHTML = `
    <div class="empty-placeholder" style="text-align:center; padding: 40px; color: var(--text-muted); grid-column: 1 / -1;">
      <i data-lucide="image-off" style="width:36px; height:36px; margin-bottom:8px;"></i>
      <p>No images match your query. Click "Upload Images" or "Add URL" to populate asset pool.</p>
    </div>`;

  const cardsHTML = images.length > 0 ? images.map(renderCardHTML).join("") : emptyHTML;

  if (container) container.innerHTML = cardsHTML;
  if (fullContainer) fullContainer.innerHTML = cardsHTML;

  // Attach event handlers
  document.querySelectorAll(".btn-delete-img").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteImageFromPool(btn.getAttribute("data-img-id"));
    };
  });

  document.querySelectorAll(".btn-edit-img").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openImageEdit(btn.getAttribute("data-img-id"));
    };
  });

  refreshLucideIcons();
}

function openImageEdit(imageId) {
  const img = state.imagePool.find(i => i.id === imageId);
  if (!img) return;

  document.getElementById("edit-image-id").value = img.id;
  document.getElementById("edit-image-title").value = img.title || "";
  document.getElementById("edit-image-filename").value = img.filename || "";
  document.getElementById("edit-image-tags").value = (img.tags || []).join(", ");
  document.getElementById("edit-image-url").value = img.url || "";

  openModal("modal-edit-image");
}

async function saveImageEdit() {
  const imageId = document.getElementById("edit-image-id").value;
  const img = state.imagePool.find(i => i.id === imageId);
  if (!img) return;

  const rawFilename = document.getElementById("edit-image-filename").value.trim() || img.filename;
  img.filename = slugifyFilename(rawFilename);
  img.title = document.getElementById("edit-image-title").value.trim() || img.title;
  img.tags = document.getElementById("edit-image-tags").value.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  img.url = document.getElementById("edit-image-url").value.trim() || buildWpUploadUrl(img.filename, state.settings);

  // If image was uploaded to WordPress REST API, update live WP Title & Alt Text too!
  if (img.wpMediaId && state.settings.wpUsername && state.settings.wpAppPassword) {
    showToast(`Syncing title & alt text to WordPress Media #${img.wpMediaId}...`, "info");
    const wpRes = await updateWordPressMediaDetails(img.wpMediaId, { title: img.title }, state.settings);
    if (wpRes && wpRes.success) {
      showToast(`Updated live in WordPress Media Library! (#${img.wpMediaId})`, "success");
    }
  }

  state.posts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool, state.settings));

  saveState();
  renderAll();
  closeModal();
  showToast("Image details, filename & keyword tags updated!", "success");
}

function deleteImageFromPool(imageId) {
  state.imagePool = state.imagePool.filter(i => i.id !== imageId);
  saveState();
  renderAll();
  showToast("Image removed from asset pool.", "info");
}

/* ==========================================================================
   TAB 3: POST QUEUE & BATCH SCHEDULER
   ========================================================================== */

function initQueueAndScheduler() {
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
    updatePromptPreview();
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
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Import JSON from Tab II or click "Load Sample Data" in top header to start.</p>
      </div>`;
    refreshLucideIcons();
    return;
  }

  container.innerHTML = state.posts.map((post, idx) => {
    const featuredImgUrl = post.featured_image ? (post.featured_image.previewUrl || post.featured_image.url) : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%231a1a1a'/%3E%3Ctext x='75' y='80' text-anchor='middle' fill='%23666' font-size='12' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";
    const statusBadgeClass = post.status === "future" ? "badge-warning" : "badge-success";
    const statusLabel = post.status === "future" ? "Scheduled" : "Publish";

    return `
    <div class="post-queue-card" data-post-id="${post.id}">
      <div class="queue-card-left">
        <img src="${escapeHtml(featuredImgUrl)}" alt="${escapeHtml(post.title)}" class="queue-post-thumb" onerror="this.onerror=null;this.src='data:image/svg+xml,%253Csvg xmlns=%2527http://www.w3.org/2000/svg%2527 width=%2527150%2527 height=%2527150%2527%253E%253Crect width=%2527150%2527 height=%2527150%2527 fill=%2527%25231a1a1a%2527/%253E%253Ctext x=%252775%2527 y=%252780%2527 text-anchor=%2527middle%2527 fill=%2527%2523666%2527 font-size=%252712%2527%253ENo Image%253C/text%253E%253C/svg%253E'" />
        <div class="queue-post-info">
          <h4>#${idx + 1}. ${escapeHtml(post.title)}</h4>
          <div class="queue-post-slug">${state.settings.domain}${state.settings.blogSubpath}${escapeHtml(post.slug)}</div>
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
   TAB 4: WXR XML EXPORT & MEDIA ZIP ENGINE
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
  document.getElementById("btn-download-media-zip").addEventListener("click", triggerMediaZipDownload);
}

function renderXmlExport() {
  const textarea = document.getElementById("xml-output-textarea");
  const postsCountEl = document.getElementById("xml-stat-posts");
  const attachmentsCountEl = document.getElementById("xml-stat-attachments");
  const yoastStatEl = document.getElementById("xml-stat-yoast");

  if (!textarea) return;

  if (state.posts.length === 0) {
    textarea.value = `<!-- No posts in queue to generate WXR XML. Ingest posts in Tab II first. -->`;
    postsCountEl.textContent = "0 Posts";
    attachmentsCountEl.textContent = "0 Attachments";
    yoastStatEl.textContent = "0% Configured";
    return;
  }

  const updatedPosts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool, state.settings));
  state.posts = updatedPosts;

  const xmlContent = generateWXRXML(state.posts, state.imagePool, {
    siteTitle: "Briants of Risborough",
    siteUrl: state.settings.domain,
    authorName: "admin"
  });

  textarea.value = xmlContent;

  postsCountEl.textContent = `${state.posts.length} Post${state.posts.length > 1 ? "s" : ""}`;
  
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

  const xmlContent = generateWXRXML(state.posts, state.imagePool, {
    siteTitle: "Briants of Risborough",
    siteUrl: state.settings.domain,
    authorName: "admin"
  });

  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `briants-wordpress-export-${dateStr}.xml`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename} successfully!`, "success");
}

function triggerMediaZipDownload() {
  if (!window.JSZip) {
    showToast("JSZip library loading error. Please check internet connection.", "error");
    return;
  }

  if (state.imagePool.length === 0) {
    showToast("No image assets in pool to download into Zip.", "warning");
    return;
  }

  const zip = new window.JSZip();
  const folderName = `wp-content-uploads-${state.settings.uploadYear}-${state.settings.uploadMonth}`;
  const imgFolder = zip.folder(folderName);

  state.imagePool.forEach(img => {
    const filename = img.filename || (img.url ? img.url.split('/').pop() : "image.jpg");

    if (img.fileData && img.fileData.startsWith("data:")) {
      const base64Data = img.fileData.split(',')[1];
      imgFolder.file(filename, base64Data, { base64: true });
    } else {
      imgFolder.file(`${filename}.url.txt`, `Image URL: ${img.url}`);
    }
  });

  zip.generateAsync({ type: "blob" }).then(content => {
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${folderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${folderName}.zip with image assets!`, "success");
  });
}

/* ==========================================================================
   MODALS: PREVIEW, EDIT, & SETTINGS
   ========================================================================== */

function initModals() {
  document.querySelectorAll(".btn-close-modal").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  });

  document.getElementById("btn-save-edit-post").addEventListener("click", savePostEdit);
  document.getElementById("btn-save-new-image").addEventListener("click", saveNewImage);
  document.getElementById("btn-save-settings").addEventListener("click", saveSiteSettings);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    if (modalId === "modal-settings") {
      populateSettingsForm();
    }
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
  document.getElementById("preview-modal-slug").textContent = `${state.settings.blogSubpath}${post.slug}`;

  document.getElementById("preview-seo-title").textContent = post.yoast_meta_title || post.title;
  document.getElementById("preview-seo-title-count").textContent = `${(post.yoast_meta_title || "").length}/60`;

  document.getElementById("preview-seo-desc").textContent = post.yoast_meta_desc || "No description set";
  document.getElementById("preview-seo-desc-count").textContent = `${(post.yoast_meta_desc || "").length}/155`;

  document.getElementById("preview-categories").innerHTML = (post.categories || [])
    .map(c => `<span class="badge badge-info"><i data-lucide="folder"></i> ${escapeHtml(c)}</span>`).join("");
  
  document.getElementById("preview-tags").innerHTML = (post.tags || [])
    .map(t => `<span class="badge badge-neutral">#${escapeHtml(t)}</span>`).join("");

  const featBox = document.getElementById("preview-featured-box");
  if (post.featured_image) {
    const src = post.featured_image.previewUrl || post.featured_image.url;
    featBox.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(post.title)}" />`;
  } else {
    featBox.innerHTML = "";
  }

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

  // Populate Featured Cover Image Select
  const featuredSelect = document.getElementById("edit-post-featured-image");
  if (featuredSelect) {
    featuredSelect.innerHTML = `<option value="">-- Auto-Match Best Image from Pool --</option>` +
      state.imagePool.map(img => {
        const isSelected = post.featured_image && (post.featured_image.id === img.id || post.featured_image.url === img.url);
        return `<option value="${img.id}" ${isSelected ? "selected" : ""}>📷 ${escapeHtml(img.title)} (${escapeHtml(img.filename)})</option>`;
      }).join("");
  }

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

  const updatedPost = autoMatchPostMedia(post, state.imagePool, state.settings);

  // Check explicit Featured Image selection
  const selectedFeaturedId = document.getElementById("edit-post-featured-image") ? document.getElementById("edit-post-featured-image").value : "";
  if (selectedFeaturedId) {
    const matchedImg = state.imagePool.find(img => img.id === selectedFeaturedId);
    if (matchedImg) {
      updatedPost.featured_image = matchedImg;
    }
  }

  const index = state.posts.findIndex(p => p.id === postId);
  state.posts[index] = updatedPost;

  saveState();
  renderAll();
  closeModal();
  showToast("Post details & Featured Cover Image saved!", "success");
}

function saveNewImage() {
  const rawFilename = document.getElementById("image-filename").value.trim() || "image.jpg";
  const filename = slugifyFilename(rawFilename);
  const manualUrl = document.getElementById("image-url").value.trim();
  const title = document.getElementById("image-title").value.trim() || "Image Asset";
  const tagsStr = document.getElementById("image-tags").value.trim();

  if (!tagsStr) {
    showToast("Please provide keyword tags for matching.", "error");
    return;
  }

  const computedUrl = manualUrl || buildWpUploadUrl(filename, state.settings);

  const newImg = {
    id: "img_" + Date.now(),
    filename: filename,
    url: computedUrl,
    title: title,
    tags: tagsStr.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
  };

  state.imagePool.push(newImg);
  state.posts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool, state.settings));

  saveState();
  renderAll();
  closeModal();

  document.getElementById("image-filename").value = "";
  document.getElementById("image-url").value = "";
  document.getElementById("image-title").value = "";
  document.getElementById("image-tags").value = "";

  showToast("Image asset saved to pool!", "success");
}

function populateSettingsForm() {
  document.getElementById("setting-domain").value = state.settings.domain || "https://briantsofrisborough.co.uk";
  document.getElementById("setting-blog-path").value = state.settings.blogSubpath || "/blog/";
  document.getElementById("setting-upload-year").value = state.settings.uploadYear || "2026";
  document.getElementById("setting-upload-month").value = state.settings.uploadMonth || "06";

  const wpUserEl = document.getElementById("setting-wp-username");
  if (wpUserEl) wpUserEl.value = state.settings.wpUsername || "";
  const wpPassEl = document.getElementById("setting-wp-app-pass");
  if (wpPassEl) wpPassEl.value = state.settings.wpAppPassword || "";

  const bankLines = (state.settings.linksBank || []).map(item => `${item.url} | ${item.label}`).join("\n");
  document.getElementById("setting-links-bank").value = bankLines;
}

function saveSiteSettings() {
  const domain = document.getElementById("setting-domain").value.trim().replace(/\/$/, "");
  const blogSubpath = document.getElementById("setting-blog-path").value.trim();
  const uploadYear = document.getElementById("setting-upload-year").value.trim();
  const uploadMonth = document.getElementById("setting-upload-month").value.trim();

  const wpUsernameEl = document.getElementById("setting-wp-username");
  const wpAppPassEl = document.getElementById("setting-wp-app-pass");
  const wpUsername = wpUsernameEl ? wpUsernameEl.value.trim() : "";
  const wpAppPassword = wpAppPassEl ? wpAppPassEl.value.trim() : "";

  const linksText = document.getElementById("setting-links-bank").value.trim();
  const linksBank = linksText.split("\n").map(line => {
    const parts = line.split("|");
    const url = parts[0] ? parts[0].trim() : "";
    const label = parts[1] ? parts[1].trim() : url;
    return url ? { url, label } : null;
  }).filter(Boolean);

  state.settings = { domain, blogSubpath, uploadYear, uploadMonth, wpUsername, wpAppPassword, linksBank };

  state.imagePool = state.imagePool.map(img => ({
    ...img,
    url: buildWpUploadUrl(img.filename || img.url.split('/').pop(), state.settings)
  }));

  state.posts = state.posts.map(p => autoMatchPostMedia(p, state.imagePool, state.settings));

  saveState();
  renderAll();
  closeModal();
  updatePromptPreview();
  showToast("Site settings & Internal Links Bank updated!", "success");
}

/* ==========================================================================
   HEADER ACTIONS & RENDERING
   ========================================================================== */

function initGlobalHeaderActions() {
  const btnDebug = document.getElementById("btn-open-debug");
  if (btnDebug) {
    btnDebug.addEventListener("click", () => {
      renderDebugConsole();
      openModal("modal-debug");
    });
  }

  const btnRefreshDebug = document.getElementById("btn-refresh-debug");
  if (btnRefreshDebug) {
    btnRefreshDebug.addEventListener("click", renderDebugConsole);
  }

  const btnCopyDebug = document.getElementById("btn-copy-debug-report");
  if (btnCopyDebug) {
    btnCopyDebug.addEventListener("click", () => {
      const report = getDiagnosticReport(state);
      navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
        showToast("Full System Diagnostic Report copied to clipboard!", "success");
      });
    });
  }

  document.getElementById("btn-open-settings").addEventListener("click", () => {
    openModal("modal-settings");
  });

  document.getElementById("btn-load-sample").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SITE_SETTINGS };
    state.imagePool = [...SAMPLE_IMAGE_POOL];
    const parsed = parseAndValidateJSON(JSON.stringify(SAMPLE_POST_PAYLOADS));
    if (parsed.valid) {
      state.posts = parsed.posts.map(post => autoMatchPostMedia(post, state.imagePool, state.settings));
      state.posts = calculateBatchSchedule(state.posts, state.scheduleConfig);
    }

    saveState();
    renderAll();
    showToast("Briants of Risborough sample data loaded!", "success");
    switchTab("tab-queue");
  });

  document.getElementById("btn-quick-export").addEventListener("click", () => {
    switchTab("tab-export");
    triggerXmlDownload();
  });
}

function renderDebugConsole() {
  const report = getDiagnosticReport(state);

  const summaryEl = document.getElementById("debug-summary-box");
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div><strong>Status:</strong> ${report.onlineStatus}</div>
      <div><strong>LocalStorage Usage:</strong> ${report.localStorageUsedMb}</div>
      <div><strong>DOM Interactive:</strong> ${report.navigationTiming ? report.navigationTiming.domInteractiveMs + 'ms' : 'N/A'}</div>
      <div><strong>DOM Complete:</strong> ${report.navigationTiming ? report.navigationTiming.domCompleteMs + 'ms' : 'N/A'}</div>
      <div><strong>Load Event End:</strong> ${report.navigationTiming ? report.navigationTiming.loadEventEndMs + 'ms' : 'N/A'}</div>
      <div><strong>WP REST API Configured:</strong> ${report.wpApiConfigured ? 'YES' : 'NO'}</div>
      <div><strong>Total Loaded Network Resources:</strong> ${report.totalResourcesLoaded}</div>
      <div><strong>Recorded Console Errors:</strong> ${report.recordedErrorsCount}</div>
    `;
  }

  const slowEl = document.getElementById("debug-slow-resources-box");
  if (slowEl) {
    if (report.slowResources.length === 0) {
      slowEl.innerHTML = `<span style="color: var(--accent-gold-dark);">✓ No stalled or slow network resources detected (>800ms).</span>`;
    } else {
      slowEl.innerHTML = report.slowResources.map(r => `
        <div style="margin-bottom:6px; padding-bottom:4px; border-bottom: 1px dashed rgba(255,255,255,0.1);">
          <strong style="color: #ef4444;">[${r.type.toUpperCase()}] ${escapeHtml(r.name)}</strong> — ${r.durationMs}ms (${r.transferBytes} bytes)
          <div style="font-size:10px; color: var(--text-dim); overflow-x: auto;">${escapeHtml(r.fullUrl)}</div>
        </div>
      `).join("");
    }
  }

  const outputEl = document.getElementById("debug-log-output");
  if (outputEl) {
    outputEl.value = JSON.stringify(report, null, 2);
  }
}

function renderAll() {
  renderMediaPool();
  renderQueuePosts();
  updateHeaderStats();
  updatePromptPreview();
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
  const mediaBadge = document.getElementById("badge-media-count");
  if (mediaBadge) mediaBadge.textContent = state.imagePool.length;
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
