
const API_BASE = window.location.port === "8080" ? "" : "http://localhost:8080";

// Bảng ảnh được load từ product-images.html
const IMAGE_MAP = {};

async function loadImageMap() {
  try {
    const res = await fetch("product-images.html");
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    doc.querySelectorAll("img[id]").forEach(img => {
      IMAGE_MAP[img.id] = img.src;
    });
  } catch (e) {
    console.warn("Không load được product-images.html", e);
  }
}

function getProductImage(p) {
  return IMAGE_MAP[p.productID] || IMAGE_MAP[p.categoryID]
    || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop";
}

async function initDatabase() {
  try {
    const res = await fetch(`${API_BASE}/api/bootstrap`);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const db = await res.json();
    localStorage.setItem("DanhMuc", JSON.stringify(db.DanhMuc || []));
    localStorage.setItem("NhanVien", JSON.stringify(db.NhanVien || []));
    localStorage.setItem("SanPham", JSON.stringify(db.SanPham || []));
    localStorage.setItem("LichSuDiem", JSON.stringify(db.LichSuDiem || []));

    const currentCust = JSON.parse(localStorage.getItem("KhachHang"));
    const phone = currentCust ? currentCust.phone : null;
    if (phone) {
      const myCust = (db.KhachHang || []).find(c => c.phone === phone);
      const myMember = (db.TheThanhVien || []).find(m => m.phone === phone);
      localStorage.setItem("KhachHang", JSON.stringify(myCust || null));
      localStorage.setItem("TheThanhVien", JSON.stringify(myMember || null));
    } else {
      if (!localStorage.getItem("KhachHang")) localStorage.setItem("KhachHang", JSON.stringify(null));
      if (!localStorage.getItem("TheThanhVien")) localStorage.setItem("TheThanhVien", JSON.stringify(null));
    }
  } catch (err) {
    console.error("Cannot load database from Java backend.", err);

    if (!localStorage.getItem("SanPham")) {
      localStorage.setItem("SanPham", JSON.stringify([]));
    }
    if (!localStorage.getItem("DanhMuc")) {
      localStorage.setItem("DanhMuc", JSON.stringify([]));
    }
    if (!localStorage.getItem("NhanVien")) {
      localStorage.setItem("NhanVien", JSON.stringify([]));
    }
    if (!localStorage.getItem("TheThanhVien")) {
      localStorage.setItem("TheThanhVien", JSON.stringify(null));
    }
    if (!localStorage.getItem("KhachHang")) {
      localStorage.setItem("KhachHang", JSON.stringify(null));
    }
    if (!localStorage.getItem("LichSuDiem")) {
      localStorage.setItem("LichSuDiem", JSON.stringify([]));
    }
  }

  if (!localStorage.getItem("GioHang")) {
    localStorage.setItem("GioHang", JSON.stringify({ cartID: 1, totalAmount: 0 }));
  }
  if (!localStorage.getItem("ChiTietGioHang")) {
    localStorage.setItem("ChiTietGioHang", JSON.stringify([]));
  }
  if (!localStorage.getItem("DonHang")) {
    localStorage.setItem("DonHang", JSON.stringify([]));
  }
  if (!localStorage.getItem("ThanhToan")) {
    localStorage.setItem("ThanhToan", JSON.stringify([]));
  }
  if (!localStorage.getItem("ChiTietDonHang")) {
    localStorage.setItem("ChiTietDonHang", JSON.stringify([]));
  }
}

function getProducts() {
  return JSON.parse(localStorage.getItem("SanPham") || "[]");
}

function saveProducts(products) {
  localStorage.setItem("SanPham", JSON.stringify(products || []));
}

async function refreshProductsFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const products = await res.json();
    saveProducts(products);
    return getProducts();
  } catch (err) {
    console.error("Không thể đồng bộ sản phẩm từ backend.", err);
    return getProducts();
  }
}

function renderStockInfo(product) {
  const remaining = Number(product?.quantityProduct || 0);
  if (remaining > 0) {
    return `<div style="margin-top: 8px; font-size: 0.82rem; font-weight: 600; color: var(--success);">Còn lại: ${remaining} chiếc</div>`;
  }
  return `<div style="margin-top: 8px; font-size: 0.82rem; font-weight: 600; color: var(--danger);">Đã hết hàng</div>`;
}

function getCategories() {
  return JSON.parse(localStorage.getItem("DanhMuc") || "[]");
}

function getCartItems() {
  return JSON.parse(localStorage.getItem("ChiTietGioHang") || "[]");
}

function saveCartItems(items) {
  localStorage.setItem("ChiTietGioHang", JSON.stringify(items));
  updateCartBadge();
  recalculateCartTotal();
}

function updateCartBadge() {
  const items = getCartItems();
  const totalQty = items.reduce((sum, item) => sum + item.quantityProduct, 0);
  const badge = document.getElementById("cart-badge");
  if (badge) {
    badge.innerText = totalQty;
  }
}

function recalculateCartTotal() {
  const items = getCartItems();
  const subtotal = items.reduce((sum, item) => sum + (item.subTotal || 0), 0);
  const gioHang = JSON.parse(localStorage.getItem("GioHang")) || { cartID: 1 };

  let discount = 0;
  if (sessionStorage.getItem("activeCoupon") === "GIAM50") {
    discount = 50000;
  }

  const shipping = parseInt(sessionStorage.getItem("shippingFee") || "0");
  const finalTotal = Math.max(0, subtotal - discount + shipping);

  gioHang.totalAmount = finalTotal;
  localStorage.setItem("GioHang", JSON.stringify(gioHang));
}

function showToast(message) {
  let toast = document.getElementById("toast-notice");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notice";
    toast.className = "toast";
    toast.innerHTML = `
      <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span id="toast-message"></span>
    `;
    document.body.appendChild(toast);
  }
  document.getElementById("toast-message").innerText = message;
  toast.classList.add("active");
  setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

function addToCart(productId, quantity = 1) {
  const products = getProducts();
  const product = products.find(p => p.productID === productId);
  if (!product) return;

  let cartItems = getCartItems();
  const existingItemIndex = cartItems.findIndex(item => item.productID === productId);

  if (existingItemIndex > -1) {
    cartItems[existingItemIndex].quantityProduct += quantity;
    cartItems[existingItemIndex].subTotal = cartItems[existingItemIndex].quantityProduct * product.priceProduct;
  } else {
    cartItems.push({
      cartID: 1,
      productID: productId,
      quantityProduct: quantity,
      subTotal: quantity * product.priceProduct
    });
  }

  saveCartItems(cartItems);
  showToast("Đã thêm vào giỏ hàng!");
}

function isValidName(name) {
  const trimmed = (name || "").trim();
  return trimmed.length >= 2 && /^[\p{L}\s]+$/u.test(trimmed) && trimmed.split(/\s+/).length >= 2;
}

function isValidPhone(phone) {
  const trimmed = (phone || "").trim();
  return /^0\d{9}$/.test(trimmed) || /^\+84\d{9}$/.test(trimmed);
}

function formatPrice(number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(number);
}

function initCountdown() {
  const hrBox = document.getElementById("cd-h");
  const minBox = document.getElementById("cd-m");
  const secBox = document.getElementById("cd-s");

  if (!hrBox || !minBox || !secBox) return;

  let totalSeconds = 4 * 3600 + 15 * 60 + 30;

  const interval = setInterval(() => {
    if (totalSeconds <= 0) {
      clearInterval(interval);
      return;
    }
    totalSeconds--;

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    hrBox.innerText = String(h).padStart(2, "0");
    minBox.innerText = String(m).padStart(2, "0");
    secBox.innerText = String(s).padStart(2, "0");
  }, 1000);
}

function renderFlashSale() {
  const grid = document.getElementById("flash-sale-grid");
  if (!grid) return;

  const products = getProducts().filter(p => p.isFlashSale);
  grid.innerHTML = products.map(p => {
    const percent = Math.round((p.soldFlash / p.limitFlash) * 100);
    return `
      <div class="product-card">
        <span class="product-badge-flash">FLASH SALE</span>
        <span class="product-installment">Trả góp 0%</span>
        <div class="product-img-wrapper">
          <img src="${getProductImage(p)}" alt="${p.productName}" class="product-img" loading="lazy">
        </div>
        <div class="product-info">
          <div class="product-brand">${p.brand}</div>
          <a href="product-detail.html?id=${p.productID}" class="product-name">${p.productName}</a>
          <div class="product-rating">
            ★★★★★ <span>(${p.reviewsCount})</span>
          </div>
          <div class="product-price-wrapper">
            <span class="product-price-sale">${formatPrice(p.priceProduct)}</span>
            <span class="product-price-original">${formatPrice(p.originalPrice)}</span>
          </div>
          ${renderStockInfo(p)}
          <div class="product-sold-progress">
            <div class="product-sold-bar" style="width: ${percent}%"></div>
            <span class="product-sold-text">Đã bán ${p.soldFlash}/${p.limitFlash}</span>
          </div>
          <div class="product-delivery-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            Giao nhanh 2h
          </div>
          <button class="product-btn-add" onclick="addToCart('${p.productID}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Thêm vào giỏ
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function renderSuggestedProducts() {
  const grid = document.getElementById("suggested-grid");
  if (!grid) return;

  const products = getProducts().filter(p => !p.isFlashSale);
  grid.innerHTML = products.map(p => {
    return `
      <div class="product-card">
        <span class="product-badge-discount">-${Math.round((1 - p.priceProduct / p.originalPrice) * 100)}%</span>
        <span class="product-installment">Trả góp 0%</span>
        <div class="product-img-wrapper">
          <img src="${getProductImage(p)}" alt="${p.productName}" class="product-img" loading="lazy">
        </div>
        <div class="product-info">
          <div class="product-brand">${p.brand}</div>
          <a href="product-detail.html?id=${p.productID}" class="product-name">${p.productName}</a>
          <div class="product-rating">
            ★★★★★ <span>(${p.reviewsCount})</span>
          </div>
          <div class="product-price-wrapper">
            <span class="product-price-sale">${formatPrice(p.priceProduct)}</span>
            <span class="product-price-original">${formatPrice(p.originalPrice)}</span>
          </div>
          ${renderStockInfo(p)}
          <div class="product-delivery-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            Miễn phí vận chuyển
          </div>
          <button class="product-btn-add" onclick="addToCart('${p.productID}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Thêm vào giỏ
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function handleSearch(event) {
  event.preventDefault();
  const input = document.getElementById("search-input");
  if (!input) return;
  const query = input.value.trim();
  if (query) {
    window.location.href = `product-list.html?search=${encodeURIComponent(query)}`;
  }
}

function runFilters() {
  const products = getProducts();
  let filtered = [...products];

  const searchParams = new URLSearchParams(window.location.search);
  const searchQ = searchParams.get("search");
  if (searchQ) {
    filtered = filtered.filter(p => p.productName.toLowerCase().includes(searchQ.toLowerCase()));
  }

  const categoryQ = searchParams.get("category");
  if (categoryQ) {
    filtered = filtered.filter(p => p.categoryID === categoryQ);
  }

  const priceSelected = document.querySelector(".price-filter:checked");
  if (priceSelected) {
    const val = priceSelected.value;
    filtered = filtered.filter(p => {
      if (val === "under5") return p.priceProduct < 5000000;
      if (val === "5to10") return p.priceProduct >= 5000000 && p.priceProduct <= 10000000;
      if (val === "over10") return p.priceProduct > 10000000;
      return true;
    });
  }
  const brandFilters = Array.from(document.querySelectorAll(".brand-filter:checked")).map(el => el.value);
  if (brandFilters.length > 0) {
    filtered = filtered.filter(p => brandFilters.includes(p.brand.toLowerCase()));
  }

  const ratingSelected = document.querySelector(".rating-filter:checked");
  if (ratingSelected) {
    const minRating = parseFloat(ratingSelected.value);
    filtered = filtered.filter(p => p.rating >= minRating);
  }
  const capacityFilters = Array.from(document.querySelectorAll(".capacity-filter:checked")).map(el => el.value);
  if (capacityFilters.length > 0) {
    filtered = filtered.filter(p => {
      return capacityFilters.some(cap => p.capacity.toLowerCase().includes(cap));
    });
  }

  const energyFilters = Array.from(document.querySelectorAll(".energy-filter:checked")).map(el => el.value);
  if (energyFilters.length > 0) {
    filtered = filtered.filter(p => energyFilters.includes(p.energySaving));
  }

  const smartFilters = Array.from(document.querySelectorAll(".smart-filter:checked")).map(el => el.value);
  if (smartFilters.length > 0) {
    filtered = filtered.filter(p => smartFilters.includes(p.smartFeature));
  }

  const sortVal = document.getElementById("sort-select")?.value || "default";
  if (sortVal === "priceAsc") {
    filtered.sort((a, b) => a.priceProduct - b.priceProduct);
  } else if (sortVal === "priceDesc") {
    filtered.sort((a, b) => b.priceProduct - a.priceProduct);
  } else if (sortVal === "rating") {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  renderListingGrid(filtered);
}

function renderListingGrid(products) {
  const countEl = document.getElementById("product-count");
  if (countEl) {
    countEl.innerText = `${products.length} sản phẩm`;
  }

  const grid = document.getElementById("listing-grid");
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 48px; color: var(--gray); font-weight: 700;">Không tìm thấy sản phẩm nào khớp với bộ lọc!</div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    return `
      <div class="product-card">
        <span class="product-badge-discount">-${Math.round((1 - p.priceProduct / p.originalPrice) * 100)}%</span>
        <span class="product-installment">Trả góp 0%</span>
        <div class="product-img-wrapper">
          <img src="${getProductImage(p)}" alt="${p.productName}" class="product-img" loading="lazy">
        </div>
        <div class="product-info">
          <div class="product-brand">${p.brand}</div>
          <a href="product-detail.html?id=${p.productID}" class="product-name">${p.productName}</a>
          <div class="product-rating">
            ★★★★★ <span>(${p.reviewsCount})</span>
          </div>
          <div class="product-price-wrapper">
            <span class="product-price-sale">${formatPrice(p.priceProduct)}</span>
            <span class="product-price-original">${formatPrice(p.originalPrice)}</span>
          </div>
          ${renderStockInfo(p)}
          <div class="product-delivery-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            Giao siêu tốc
          </div>
          <button class="product-btn-add" onclick="addToCart('${p.productID}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Thêm vào giỏ
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function initListingPage() {
  const listingGrid = document.getElementById("listing-grid");
  if (!listingGrid) return;

  const checkboxes = document.querySelectorAll(".sidebar input[type='checkbox']");
  checkboxes.forEach(chk => {
    // Dùng click thay change để bắt cả click vào ô đang được chọn
    chk.addEventListener("click", function (e) {
      const singleSelectClasses = ["price-filter", "rating-filter"];
      singleSelectClasses.forEach(cls => {
        if (this.classList.contains(cls)) {
          if (!this.checked) {
            // Đang bỏ chọn — giữ nguyên, không làm gì thêm
          } else {
            // Đang chọn mới — bỏ các cái khác trong nhóm
            document.querySelectorAll("." + cls).forEach(other => {
              if (other !== this) other.checked = false;
            });
          }
        }
      });

      const scrollY = window.scrollY;
      runFilters();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, scrollY);
        });
      });
    });
  });

  const sortSel = document.getElementById("sort-select");
  if (sortSel) {
    sortSel.addEventListener("change", runFilters);
  }

  runFilters();
}

function initDetailPage() {
  const detailMain = document.querySelector(".detail-main");
  if (!detailMain) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id") || "SP_MG_01";
  const products = getProducts();
  const p = products.find(prod => prod.productID === productId);

  if (!p) {
    detailMain.innerHTML = `<div style="text-align: center; padding: 48px; color: var(--gray); font-weight: 700;">Không tìm thấy sản phẩm yêu cầu!</div>`;
    return;
  }

  const brandEl = document.getElementById("dp-brand");
  const nameEl = document.getElementById("dp-name");
  const ratingEl = document.getElementById("dp-rating-num");
  const reviewsEl = document.getElementById("dp-reviews-count");
  const soldEl = document.getElementById("dp-sold-count");
  const saleEl = document.getElementById("dp-price-sale");
  const origEl = document.getElementById("dp-price-original");
  const badgeEl = document.getElementById("dp-price-badge");
  const btnCart = document.getElementById("dp-btn-cart");
  const btnBuy = document.getElementById("dp-btn-buy");

  if (brandEl) brandEl.innerText = p.brand;
  if (nameEl) nameEl.innerText = p.productName;
  if (ratingEl) ratingEl.innerText = p.rating;
  if (reviewsEl) reviewsEl.innerText = `${p.reviewsCount} Đánh giá`;
  if (soldEl) soldEl.innerText = `${p.soldCount} Đã bán`;
  if (saleEl) saleEl.innerText = formatPrice(p.priceProduct);
  if (origEl) origEl.innerText = formatPrice(p.originalPrice);
  if (badgeEl) badgeEl.innerText = `Giảm -${Math.round((1 - p.priceProduct / p.originalPrice) * 100)}%`;

  // Set ảnh gallery
  let imgUrls = [];
  for (let i = 1; i <= 6; i++) {
    let suffix = i === 1 ? "" : "_" + i;
    let u = IMAGE_MAP[p.productID + suffix];
    if (u) imgUrls.push(u);
  }
  if (imgUrls.length === 0) {
    imgUrls.push(IMAGE_MAP[p.categoryID] || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop");
  }

  const galleryMain = document.querySelector(".detail-gallery-main");
  if (galleryMain && imgUrls.length > 0) {
    galleryMain.innerHTML = `<img src="${imgUrls[0]}" alt="${p.productName}" id="dp-main-img" style="width:100%;height:100%;object-fit:contain;border-radius:var(--radius);">`;
  }

  const galleryThumbs = document.querySelector(".detail-gallery-thumbs");
  if (galleryThumbs && imgUrls.length > 0) {
    galleryThumbs.innerHTML = imgUrls.map((u, i) => `
      <div class="detail-thumb ${i === 0 ? 'active' : ''}" data-url="${u}">
        <img src="${u}" alt="${p.productName}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">
      </div>
    `).join("");

    document.querySelectorAll(".detail-thumb").forEach(thumb => {
      thumb.onclick = function () {
        const url = this.getAttribute("data-url");
        const mainImg = document.getElementById("dp-main-img");
        if (mainImg) mainImg.src = url;
        document.querySelectorAll(".detail-thumb").forEach(t => t.classList.remove("active"));
        this.classList.add("active");
      };
    });
  }

  if (btnCart) {
    btnCart.onclick = () => addToCart(p.productID, 1);
  }
  if (btnBuy) {
    btnBuy.onclick = () => {
      addToCart(p.productID, 1);
      setTimeout(() => {
        window.location.href = "cart.html";
      }, 500);
    };
  }

  const specsTable = document.getElementById("dp-specs-table");
  if (specsTable) {
    specsTable.innerHTML = `
      <tr>
        <td>Thương hiệu</td>
        <td>${p.brand}</td>
      </tr>
      <tr>
        <td>Mã sản phẩm</td>
        <td>${p.productID}</td>
      </tr>
      <tr>
        <td>Dung tích/Kích thước</td>
        <td>${p.capacity}</td>
      </tr>
      <tr>
        <td>Tiết kiệm năng lượng</td>
        <td>${p.energySaving}</td>
      </tr>
      <tr>
        <td>Tính năng thông minh</td>
        <td>${p.smartFeature === "Có" ? "Hỗ trợ kết nối WiFi và điều khiển qua ứng dụng" : "Không hỗ trợ"}</td>
      </tr>
      <tr>
        <td>Số lượng tồn kho</td>
        <td>${p.quantityProduct} chiếc</td>
      </tr>
      <tr>
        <td>Mô tả tóm tắt</td>
        <td>${p.descriptionProduct}</td>
      </tr>
    `;
  }

  const relatedGrid = document.getElementById("dp-related-grid");
  if (relatedGrid) {
    const related = products.filter(item => item.categoryID === p.categoryID && item.productID !== p.productID).slice(0, 4);
    if (related.length === 0) {
      relatedGrid.innerHTML = `<div style="grid-column: span 4; text-align: center; color: var(--gray); font-size: 0.9rem;">Không có sản phẩm liên quan tương tự.</div>`;
    } else {
      relatedGrid.innerHTML = related.map(item => `
        <div class="product-card">
          <span class="product-badge-discount">-${Math.round((1 - item.priceProduct / item.originalPrice) * 100)}%</span>
          <div class="product-img-wrapper">
            <img src="${getProductImage(item)}" alt="${item.productName}" class="product-img" loading="lazy">
          </div>
          <div class="product-info">
            <div class="product-brand">${item.brand}</div>
            <a href="product-detail.html?id=${item.productID}" class="product-name">${item.productName}</a>
            <div class="product-price-wrapper">
              <span class="product-price-sale">${formatPrice(item.priceProduct)}</span>
            </div>
            ${renderStockInfo(item)}
            <button class="product-btn-add" onclick="addToCart('${item.productID}')">Thêm vào giỏ</button>
          </div>
        </div>
      `).join("");
    }
  }
}

function renderCartList() {
  const items = getCartItems();
  const products = getProducts();
  const container = document.getElementById("cart-items-container");
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--gray);">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <p style="font-weight: 700; margin-bottom: 16px;">Giỏ hàng của bạn đang trống!</p>
        <a href="product-list.html" class="btn btn-blue" style="font-size: 0.85rem;">Mua sắm ngay</a>
      </div>
    `;
    updateCartSummaryDOM(0);
    return;
  }

  let html = `
    <div class="cart-table-header">
      <div>Sản phẩm</div>
      <div>Đơn giá</div>
      <div>Số lượng</div>
      <div>Thành tiền</div>
      <div></div>
    </div>
  `;

  let subtotal = 0;

  items.forEach(item => {
    const p = products.find(prod => prod.productID === item.productID);
    if (!p) return;
    subtotal += item.subTotal;
    html += `
      <div class="cart-item">
        <div class="cart-product-info">
          <div class="cart-product-img">
            <img src="${getProductImage(p)}" alt="${p.productName}" style="width:80px;height:80px;object-fit:contain;border-radius:8px;">
          </div>
          <div class="cart-product-detail">
            <a href="product-detail.html?id=${p.productID}" class="cart-product-name">${p.productName}</a>
            <span class="cart-product-color">Màu sắc: Tiêu chuẩn | Dung tích: ${p.capacity}</span>
          </div>
        </div>
        <div class="cart-price-box">
          <span class="cart-price-sale">${formatPrice(p.priceProduct)}</span>
          <span class="cart-price-original">${formatPrice(p.originalPrice)}</span>
        </div>
        <div>
          <div class="quantity-control">
            <button class="quantity-btn" onclick="updateQty('${p.productID}', -1)">-</button>
            <input type="text" class="quantity-input" value="${item.quantityProduct}" readonly>
            <button class="quantity-btn" onclick="updateQty('${p.productID}', 1)">+</button>
          </div>
        </div>
        <div>
          <span class="cart-subtotal">${formatPrice(item.subTotal)}</span>
        </div>
        <div>
          <button class="cart-remove-btn" onclick="removeCartItem('${p.productID}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  updateCartSummaryDOM(subtotal);
}

function updateQty(productId, delta) {
  let items = getCartItems();
  const idx = items.findIndex(item => item.productID === productId);
  if (idx === -1) return;

  const products = getProducts();
  const p = products.find(prod => prod.productID === productId);

  items[idx].quantityProduct += delta;
  if (items[idx].quantityProduct <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].subTotal = items[idx].quantityProduct * p.priceProduct;
  }

  saveCartItems(items);
  renderCartList();
}

function removeCartItem(productId) {
  let items = getCartItems();
  items = items.filter(item => item.productID !== productId);
  saveCartItems(items);
  renderCartList();
  showToast("Đã xóa sản phẩm khỏi giỏ hàng!");
}

function updateCartSummaryDOM(subtotal) {
  const subtotalEl = document.getElementById("summary-subtotal");
  const discountEl = document.getElementById("summary-discount");
  const shippingEl = document.getElementById("summary-shipping");
  const totalEl = document.getElementById("summary-total");

  if (!subtotalEl) return;

  subtotalEl.innerText = formatPrice(subtotal);

  let discount = 0;
  if (sessionStorage.getItem("activeCoupon") === "GIAM50" && subtotal > 0) {
    discount = 50000;
  }
  discountEl.innerText = discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0);

  const shipping = subtotal > 0 ? 30000 : 0;
  sessionStorage.setItem("shippingFee", String(shipping));
  shippingEl.innerText = formatPrice(shipping);

  const finalTotal = Math.max(0, subtotal - discount + shipping);
  totalEl.innerText = formatPrice(finalTotal);

  recalculateCartTotal();
}

function applyCoupon() {
  const input = document.getElementById("coupon-code");
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (code === "GIAM50") {
    sessionStorage.setItem("activeCoupon", "GIAM50");
    showToast("Áp dụng mã giảm giá thành công! Giảm 50.000đ");
    renderCartList();
  } else {
    showToast("Mã giảm giá không hợp lệ hoặc đã hết hạn!");
  }
}

function renderCartSuggestions() {
  const grid = document.getElementById("cart-suggested-grid");
  if (!grid) return;

  const products = getProducts().slice(4, 8);
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <div class="product-img-wrapper">
        <img src="${getProductImage(p)}" alt="${p.productName}" class="product-img" loading="lazy">
      </div>
      <div class="product-info">
        <a href="product-detail.html?id=${p.productID}" class="product-name" style="height: 38px;">${p.productName}</a>
        <div class="product-price-wrapper">
          <span class="product-price-sale">${formatPrice(p.priceProduct)}</span>
        </div>
        <button class="product-btn-add" onclick="addToCart('${p.productID}'); setTimeout(renderCartList, 100);">Thêm vào giỏ</button>
      </div>
    </div>
  `).join("");
}

function initCartPage() {
  renderCartList();
  renderCartSuggestions();

  const couponBtn = document.getElementById("btn-apply-coupon");
  if (couponBtn) {
    couponBtn.onclick = applyCoupon;
  }
}

function initCheckoutPage() {
  const items = getCartItems();
  const products = getProducts();
  const summaryList = document.getElementById("checkout-summary-list");
  if (!summaryList) return;

  console.log("[DEBUG] initCheckoutPage | items:", items.length, "| products:", products.length);

  if (items.length === 0) {
    summaryList.innerHTML = `<div style="color: var(--gray); text-align: center; padding: 24px 0;">Giỏ hàng trống!</div>`;
    // KHÔNG return sớm — vẫn cần bind các event phía dưới
  }

  let subtotal = 0;
  let html = "";

  items.forEach(item => {
    const p = products.find(prod => prod.productID === item.productID);
    if (!p) return;
    subtotal += item.subTotal;
    html += `
      <div class="summary-row" style="font-size: 0.85rem; margin-bottom: 12px; gap: 16px;">
        <span style="font-weight: 600; text-align: left; flex: 1;">${p.productName} <strong style="color: var(--primary);">x${item.quantityProduct}</strong></span>
        <span style="font-weight: 700; color: var(--dark); flex-shrink: 0;">${formatPrice(item.subTotal)}</span>
      </div>
    `;
  });

  summaryList.innerHTML = html;

  const subtotalEl = document.getElementById("checkout-subtotal");
  const discountEl = document.getElementById("checkout-discount");
  const shippingEl = document.getElementById("checkout-shipping");
  const totalEl = document.getElementById("checkout-total");

  subtotalEl.innerText = formatPrice(subtotal);

  let discount = 0;
  if (sessionStorage.getItem("activeCoupon") === "GIAM50") {
    discount = 50000;
  }
  discountEl.innerText = discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0);

  let shipFee = parseInt(sessionStorage.getItem("shippingFee") || "30000");
  shippingEl.innerText = formatPrice(shipFee);

  let finalTotal = Math.max(0, subtotal - discount + shipFee);
  totalEl.innerText = formatPrice(finalTotal);

  const shipCards = document.querySelectorAll(".shipping-card");
  shipCards.forEach(card => {
    card.onclick = () => {
      shipCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      card.querySelector("input").checked = true;

      const rate = parseInt(card.dataset.rate || "0");
      shipFee = rate;
      sessionStorage.setItem("shippingFee", String(rate));
      shippingEl.innerText = formatPrice(rate);

      finalTotal = Math.max(0, subtotal - discount + rate);
      totalEl.innerText = formatPrice(finalTotal);
    };
  });

  const payCards = document.querySelectorAll(".payment-card");
  payCards.forEach(card => {
    card.onclick = () => {
      payCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      card.querySelector("input").checked = true;
    };
  });

  const custData = JSON.parse(localStorage.getItem("KhachHang"));
  if (custData) {
    const coName = document.getElementById("co-name");
    const coPhone = document.getElementById("co-phone");
    const coAddress = document.getElementById("co-address");
    if (coName && custData.name) coName.value = custData.name;
    if (coPhone && custData.phone) coPhone.value = custData.phone;
    if (coAddress && custData.address) coAddress.value = custData.address;
  }

  const orderForm = document.getElementById("checkout-order-form");
  if (orderForm) {
    orderForm.onsubmit = async (e) => {
      e.preventDefault();

      const fullName = document.getElementById("co-name").value.trim();
      const phone = document.getElementById("co-phone").value.trim();
      const address = document.getElementById("co-address").value.trim();

      if (!fullName || !phone || !address) {
        showToast("Vui lòng điền đầy đủ địa chỉ nhận hàng!");
        return;
      }
      if (!isValidName(fullName)) {
        showToast("Tên người nhận phải có ít nhất 2 từ và chỉ chứa chữ cái.");
        return;
      }
      if (!isValidPhone(phone)) {
        showToast("Số điện thoại không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 0.");
        return;
      }

      const activeShipCard = document.querySelector(".shipping-card.active");
      const shipMethod = activeShipCard ? activeShipCard.querySelector(".shipping-name").innerText : "Giao hàng tiêu chuẩn";

      const activePayCard = document.querySelector(".payment-card.active");
      const payMethod = activePayCard ? activePayCard.querySelector(".payment-name").innerText : "Thanh toán khi nhận hàng (COD)";

      const newOrderId = "DH-" + Math.floor(100000 + Math.random() * 900000);
      const newPaymentId = "TT-" + Math.floor(100000 + Math.random() * 900000);

      const cust = JSON.parse(localStorage.getItem("KhachHang")) || { phone: "" };
      const orderDateStr = new Date().toISOString();

      const formData = new URLSearchParams();
      formData.append("orderId", newOrderId);
      formData.append("orderDate", orderDateStr);
      formData.append("totalAmount", finalTotal);
      formData.append("shippingAddress", `${address} | SĐT: ${phone} | Người nhận: ${fullName}`);
      formData.append("status", "Chờ xác nhận");
      formData.append("paymentMethod", payMethod);
      formData.append("customerPhone", phone);
      formData.append("customerName", fullName);
      formData.append("customerAddress", address);
      formData.append("staffId", "NV001");

      formData.append("itemCount", items.length);
      items.forEach((item, index) => {
        const prod = products.find(pr => pr.productID === item.productID);
        formData.append(`item_${index}_id`, item.productID);
        formData.append(`item_${index}_qty`, item.quantityProduct);
        formData.append(`item_${index}_price`, prod ? prod.priceProduct : 0);
      });

      let checkoutSucceeded = false;
      try {
        const res = await fetch(`${API_BASE}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString()
        });
        if (!res.ok) {
          throw new Error(`Checkout failed with status ${res.status}`);
        }
        checkoutSucceeded = true;
      } catch (err) {
        console.error("Backend checkout request failed:", err);
      }

      if (checkoutSucceeded) {
        await refreshProductsFromServer();
        if (window.location.pathname.includes("product-list.html")) {
          initListingPage();
        } else if (window.location.pathname.includes("product-detail.html")) {
          initDetailPage();
        } else {
          renderFlashSale();
          renderSuggestedProducts();
        }
      }

      const donHang = JSON.parse(localStorage.getItem("DonHang")) || [];
      const ctDonHang = JSON.parse(localStorage.getItem("ChiTietDonHang")) || [];

      const orderData = {
        orderId: newOrderId,
        orderDate: orderDateStr,
        totalAmount: finalTotal,
        shippingAddress: `${address} | SĐT: ${phone} | Người nhận: ${fullName}`,
        status: "Chờ xác nhận",
        paymentMethod: payMethod,
        customerPhone: cust.phone || "",
        staffId: "NV001"
      };

      donHang.push(orderData);

      items.forEach(item => {
        const prod = products.find(pr => pr.productID === item.productID);
        ctDonHang.push({
          orderId: newOrderId,
          productID: item.productID,
          quantity: item.quantityProduct,
          unitPrice: prod ? prod.priceProduct : 0
        });
      });

      localStorage.setItem("DonHang", JSON.stringify(donHang));
      localStorage.setItem("ChiTietDonHang", JSON.stringify(ctDonHang));
      console.log("[DEBUG] Đã lưu đơn hàng:", newOrderId, "| DonHang hiện tại:", donHang.length, "đơn");

      const member = JSON.parse(localStorage.getItem("TheThanhVien"));
      const earnedPoints = Math.floor(finalTotal / 20000);
      
      if (member && member.phone === phone) {
        member.point += earnedPoints;
        if (member.isCancelled) {
          member.isCancelled = false;
        }
        if (member.point >= 2000) {
          member.rank = "Vàng";
          member.discountRate = 0.10;
        } else if (member.point >= 1000) {
          member.rank = "Bạc";
          member.discountRate = 0.05;
        }
        localStorage.setItem("TheThanhVien", JSON.stringify(member));
      }

      const history = JSON.parse(localStorage.getItem("LichSuDiem")) || [];
      history.unshift({
        phone: phone,
        date: new Date().toISOString().split("T")[0],
        orderId: newOrderId,
        points: earnedPoints,
        type: "cộng",
        reason: `Tích lũy đơn hàng ${newOrderId}`
      });
      localStorage.setItem("LichSuDiem", JSON.stringify(history));

      if (checkoutSucceeded) {
        localStorage.setItem("ChiTietGioHang", JSON.stringify([]));
      }
      sessionStorage.removeItem("activeCoupon");
      sessionStorage.removeItem("shippingFee");

      const gioHangObj = JSON.parse(localStorage.getItem("GioHang")) || {};
      gioHangObj.totalAmount = 0;
      localStorage.setItem("GioHang", JSON.stringify(gioHangObj));

      updateCartBadge();

      const modal = document.getElementById("success-modal");
      if (modal) {
        modal.classList.add("active");
      }
    };
  }
}


window.switchTab = function (tabName) {
  let member = JSON.parse(localStorage.getItem("TheThanhVien"));
  let actualTabToRender = tabName;
  if (tabName === 'member-card' && (!member || member.isCancelled)) {
    actualTabToRender = 'personal-info';
  }

  document.querySelectorAll('.profile-nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById('nav-' + tabName);
  if (activeNav) activeNav.classList.add('active');

  const tabMemberCard = document.getElementById('tab-member-card');
  const tabPersonalInfo = document.getElementById('tab-personal-info');
  const tabMyOrders = document.getElementById('tab-my-orders');

  if (tabMemberCard) tabMemberCard.style.display = 'none';
  if (tabPersonalInfo) tabPersonalInfo.style.display = 'none';
  if (tabMyOrders) tabMyOrders.style.display = 'none';

  const activeTab = document.getElementById('tab-' + actualTabToRender);
  if (activeTab) activeTab.style.display = 'block';
};

function initProfilePage() {
  let member = JSON.parse(localStorage.getItem("TheThanhVien"));
  let cust = JSON.parse(localStorage.getItem("KhachHang"));
  
  if (!cust || !cust.name) {
    cust = { phone: "", name: "", email: "", address: "" };
  }

  const myOrdersTableBody = document.getElementById("my-orders-table-body");
  if (myOrdersTableBody) {
    const allOrders = JSON.parse(localStorage.getItem("DonHang")) || [];
    const myOrders = allOrders.filter(o => o.customerPhone === cust.phone && cust.phone !== "");

    myOrdersTableBody.innerHTML = "";
    if (myOrders.length === 0) {
      myOrdersTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-light); padding: 32px 0;">Bạn chưa có đơn hàng nào.</td></tr>`;
    } else {
      myOrders.forEach(order => {
        const tr = document.createElement("tr");
        
        let statusBadge = '';
        const status = order.status || 'Chờ xác nhận';
        if (status === 'Chờ xác nhận') statusBadge = `<span style="background: #fef08a; color: #854d0e; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">${status}</span>`;
        else if (status === 'Đã xác nhận') statusBadge = `<span style="background: #bbf7d0; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">${status}</span>`;
        else if (status === 'Đã hủy') statusBadge = `<span style="background: #fecaca; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">${status}</span>`;
        else statusBadge = `<span style="background: #e2e8f0; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem;">${status}</span>`;

        let actionBtn = '';
        if (status === 'Chờ xác nhận') {
           actionBtn = `<button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 6px; cursor: pointer; border: none;" onclick="cancelMyOrder('${order.orderId}')">Hủy đơn</button>`;
        }

        tr.innerHTML = `
          <td><span style="font-weight: 600; color: var(--primary);">${order.orderId}</span></td>
          <td>${order.orderDate}</td>
          <td><span style="color: var(--danger); font-weight: 600;">${order.totalAmount.toLocaleString('vi-VN')}đ</span></td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        `;
        myOrdersTableBody.appendChild(tr);
      });
    }
  }

  const history = (JSON.parse(localStorage.getItem("LichSuDiem")) || []).filter(item => item.phone === cust.phone);
  if (!member || !member.cardID) {
    member = { cardID: "TV-NEW", phone: "", point: 0, rank: "Đồng", discountRate: 0.00, isCancelled: true };
  }

  const cardContainer = document.getElementById("member-card-dom");
  const cardNum = document.getElementById("member-card-number");
  const holderName = document.getElementById("member-holder-name");
  const pointsVal = document.getElementById("member-points-value");
  const tierVal = document.getElementById("member-tier-value");

  if (cardContainer) {
    cardContainer.classList.remove("bronze", "silver", "gold");
    if (member.isCancelled) {
      cardContainer.style.opacity = "0.4";
      cardContainer.style.filter = "grayscale(1)";
    } else {
      cardContainer.style.opacity = "1";
      cardContainer.style.filter = "none";
    }

    if (member.rank === "Vàng") {
      cardContainer.classList.add("gold");
    } else if (member.rank === "Bạc") {
      cardContainer.classList.add("silver");
    } else {
      cardContainer.classList.add("bronze");
    }
  }

  if (cardNum) cardNum.innerText = member.cardID;
  if (holderName) holderName.innerText = (cust.name || "KHÁCH").toUpperCase();
  if (pointsVal) pointsVal.innerText = `${member.point} Điểm`;
  if (tierVal) tierVal.innerText = `${member.rank} MEMBER`;

  const sidebarUsername = document.getElementById("sidebar-username");
  const sidebarUserRank = document.getElementById("sidebar-userrank");
  if (sidebarUsername) {
    sidebarUsername.innerText = (cust && cust.name) ? cust.name : "Khách";
  }
  if (sidebarUserRank) {
    sidebarUserRank.innerText = (member && !member.isCancelled && cust.name) ? `${member.rank} MEMBER` : "Chưa đăng ký";
  }

  const bar = document.getElementById("upgrade-progress-bar");
  const label = document.getElementById("upgrade-progress-label");
  const desc = document.getElementById("upgrade-progress-desc");
  const upgradeTitle = document.getElementById("upgrade-title");

  if (bar && label && desc) {
    if (member.isCancelled) {
      bar.style.width = "0%";
      label.innerText = "0/1000 điểm";
      desc.innerText = "Vui lòng đăng ký lại thẻ để kích hoạt tiến trình nâng hạng.";
      if (upgradeTitle) upgradeTitle.innerText = "Tiến độ nâng hạng (Thẻ chưa kích hoạt)";
    } else if (member.rank === "Đồng") {
      const pct = Math.min(100, (member.point / 1000) * 100);
      bar.style.width = `${pct}%`;
      bar.style.background = "linear-gradient(90deg, #854d0e 0%, #a16207 100%)";
      label.innerText = `${member.point}/1000 điểm`;
      desc.innerText = `Tích lũy thêm ${1000 - member.point} điểm nữa để thăng hạng thẻ BẠC (nhận giảm giá tới 5% đơn hàng)`;
      if (upgradeTitle) upgradeTitle.innerText = "Tiến độ nâng hạng (Thẻ Đồng lên Thẻ Bạc)";
    } else if (member.rank === "Bạc") {
      const pct = Math.min(100, (member.point / 2000) * 100);
      bar.style.width = `${pct}%`;
      bar.style.background = "linear-gradient(90deg, #64748b 0%, #cbd5e1 100%)";
      label.innerText = `${member.point}/2000 điểm`;
      desc.innerText = `Tích lũy thêm ${Math.max(0, 2000 - member.point)} điểm nữa để thăng hạng thẻ VÀNG (nhận giảm giá tới 10% đơn hàng)`;
      if (upgradeTitle) upgradeTitle.innerText = "Tiến độ nâng hạng (Thẻ Bạc lên Thẻ Vàng)";
    } else {
      bar.style.width = `100%`;
      bar.style.background = "linear-gradient(90deg, #d97706 0%, #fbbf24 100%)";
      label.innerText = `${member.point} điểm`;
      desc.innerText = `Chúc mừng bạn! Bạn đã đạt hạng thẻ VÀNG cao cấp và nhận đặc quyền giảm giá 10% mặc định!`;
      if (upgradeTitle) upgradeTitle.innerText = "Hạng thẻ cao nhất (Thẻ Vàng)";
    }
  }

  const tableBody = document.getElementById("points-table-body");
  if (tableBody) {
    tableBody.innerHTML = history.map(item => `
      <tr>
        <td style="font-weight: 700; color: var(--dark-light);">${item.date}</td>
        <td><span style="font-weight: 600; padding: 4px 8px; border-radius: 6px; background-color: var(--light); font-size: 0.8rem;">${item.orderId}</span></td>
        <td><span class="${item.type === "cộng" ? "points-add" : "points-sub"}">${item.type === "cộng" ? "+" : ""}${item.points}</span></td>
        <td style="color: var(--gray); font-size: 0.85rem; font-weight: 500;">${item.reason}</td>
      </tr>
    `).join("");
  }

  window.redeemVoucher = async (cost, voucherName) => {
    let currentMember = JSON.parse(localStorage.getItem("TheThanhVien"));
    if (currentMember.isCancelled) {
      showToast("Thẻ thành viên của bạn đã bị hủy. Vui lòng đăng ký lại thẻ để đổi voucher!");
      return;
    }
    if (currentMember.point < cost) {
      showToast("Không đủ điểm thưởng để đổi voucher này!");
      return;
    }
    const cust = JSON.parse(localStorage.getItem("KhachHang")) || { phone: "" };

    const formData = new URLSearchParams();
    formData.append("customerPhone", cust.phone || "");
    formData.append("pointsChange", -cost);
    formData.append("action", "redeem");
    formData.append("orderId", "VOUCHER");
    formData.append("type", "trừ");
    formData.append("reason", `Đổi voucher ${voucherName}`);
    formData.append("date", new Date().toISOString().split("T")[0]);

    try {
      const res = await fetch(`${API_BASE}/api/member/update-points`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
      });
      if (!res.ok) {
        console.error("Backend points deduction failed");
      }
    } catch (err) {
      console.error("Backend points deduction request failed:", err);
    }

    currentMember.point -= cost;
    localStorage.setItem("TheThanhVien", JSON.stringify(currentMember));

    const currentHistory = JSON.parse(localStorage.getItem("LichSuDiem")) || [];
    currentHistory.unshift({
      phone: cust.phone,
      date: new Date().toISOString().split("T")[0],
      orderId: "VOUCHER",
      points: -cost,
      type: "trừ",
      reason: `Đổi voucher ${voucherName}`
    });
    localStorage.setItem("LichSuDiem", JSON.stringify(currentHistory));

    initProfilePage();
    showToast(`Đổi mã giảm giá thành công! Voucher: GIAM50`);
  };

  const cancelBtn = document.getElementById("btn-cancel-membership");
  const cancelTitle = document.querySelector(".cancel-membership-title");
  const cancelDesc = document.querySelector(".cancel-membership-desc");

  if (cancelBtn && cancelTitle && cancelDesc) {
    if (member.isCancelled) {
      cancelTitle.innerText = "Đăng Ký Thành Viên";
      cancelTitle.style.color = "var(--success)";
      cancelDesc.innerText = "Đăng ký lại thẻ thành viên để nhận đặc quyền tích điểm thưởng và nâng hạng thẻ.";
      cancelBtn.innerText = "Đăng Ký Lại";
      cancelBtn.className = "btn btn-blue";
      cancelBtn.onclick = () => {
        window.switchTab('personal-info');
        showToast("Vui lòng điền thông tin để đăng ký lại thẻ thành viên.");
      };
    } else {
      cancelTitle.innerText = "Hủy Tư Cách Thành Viên";
      cancelTitle.style.color = "var(--danger)";
      cancelDesc.innerText = "Lưu ý: Hành động này sẽ đặt lại điểm tích lũy của bạn về 0 và thu hồi toàn bộ ưu đãi giảm giá.";
      cancelBtn.innerText = "Hủy Thành Viên";
      cancelBtn.className = "btn btn-danger";
      cancelBtn.onclick = async () => {
        if (!confirm("Bạn có chắc chắn muốn hủy tư cách thành viên không? Điểm tích lũy sẽ bị đặt về 0.")) {
          return;
        }
        const currentMember = JSON.parse(localStorage.getItem("TheThanhVien"));
        const cust = JSON.parse(localStorage.getItem("KhachHang")) || { phone: "" };
        const finalPhone = (currentMember && currentMember.phone) ? currentMember.phone : cust.phone;

        const formData = new URLSearchParams();
        formData.append("customerPhone", finalPhone || "");
        formData.append("pointsChange", 0);
        formData.append("action", "cancel");
        formData.append("orderId", "HỦY THẺ");
        formData.append("type", "trừ");
        formData.append("reason", "Hủy thẻ thành viên (Đặt lại điểm về 0)");
        formData.append("date", new Date().toISOString().split("T")[0]);

        try {
          const res = await fetch(`${API_BASE}/api/member/update-points`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString()
          });
          if (!res.ok) {
            console.error("Backend member cancellation failed");
          }
        } catch (err) {
          console.error("Backend member cancellation request failed:", err);
        }

        currentMember.isCancelled = true;
        currentMember.point = 0;
        currentMember.rank = "Đồng";
        currentMember.discountRate = 0.00;
        localStorage.setItem("TheThanhVien", JSON.stringify(currentMember));
        localStorage.removeItem("KhachHang");
        
        let currentHistory = JSON.parse(localStorage.getItem("LichSuDiem")) || [];
        currentHistory = currentHistory.filter(h => h.phone !== finalPhone);
        localStorage.setItem("LichSuDiem", JSON.stringify(currentHistory));

        initProfilePage();
        showToast("Đã hủy thẻ thành viên thành công! Điểm số được đặt lại về 0.");
      };
    }
  }

  const piName = document.getElementById("pi-name");
  const piPhone = document.getElementById("pi-phone");
  const piAddress = document.getElementById("pi-address");

  if (piName && cust.name) piName.value = cust.name;
  if (piPhone && cust.phone) piPhone.value = cust.phone;
  if (piAddress && cust.address) piAddress.value = cust.address;

  const formPersonalInfo = document.getElementById("form-personal-info");
  if (formPersonalInfo) {
    formPersonalInfo.onsubmit = async (e) => {
      e.preventDefault();

      const nameValue = piName.value.trim();
      const phoneValue = piPhone.value.trim();
      const addressValue = piAddress.value.trim();

      if (!isValidName(nameValue)) {
        showToast("Tên thành viên phải có ít nhất 2 từ và chỉ chứa chữ cái.");
        return;
      }
      if (!isValidPhone(phoneValue)) {
        showToast("Số điện thoại không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 0.");
        return;
      }

      cust.name = nameValue;
      cust.phone = phoneValue;
      cust.address = addressValue;
      const formData = new URLSearchParams();
      formData.append("name", cust.name);
      formData.append("phone", cust.phone);
      formData.append("address", cust.address);

      try {
        const response = await fetch(`${API_BASE}/api/member/register`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString()
        });

        if (response.ok) {
          localStorage.setItem("KhachHang", JSON.stringify(cust));

          if (!member || !member.cardID || member.isCancelled) {
            member.isCancelled = false;
            member.point = 0;
            member.rank = "Đồng";
            member.discountRate = 0.00;
            member.phone = cust.phone;
            localStorage.setItem("TheThanhVien", JSON.stringify(member));
          }

          initProfilePage();
          window.switchTab('member-card');
          showToast("Cập nhật thông tin và thẻ thành viên thành công!");
        } else {
          showToast("Đăng ký không thành công!");
        }
      } catch (err) {
        console.error(err);
        showToast("Lỗi kết nối máy chủ!");
      }

    };
  }

  // Auto switch to personal info if member is not registered
  if (member && member.isCancelled) {
    window.switchTab('member-card');
  }
}

let orderToCancel = null;

window.cancelMyOrder = function(orderId) {
    orderToCancel = orderId;
    const modalIdSpan = document.getElementById("cancel-modal-order-id");
    const reasonInput = document.getElementById("cancel-order-reason");
    const modal = document.getElementById("cancel-order-modal");
    
    if (modalIdSpan) modalIdSpan.textContent = orderId;
    if (reasonInput) reasonInput.value = "";
    if (modal) modal.style.display = "flex";
};

window.closeCancelOrderModal = function() {
    orderToCancel = null;
    const modal = document.getElementById("cancel-order-modal");
    if (modal) modal.style.display = "none";
};

window.submitCancelOrder = async function() {
    if (!orderToCancel) return;
    
    const reasonInput = document.getElementById("cancel-order-reason");
    const reason = reasonInput ? reasonInput.value.trim() : "";
    
    if (reason === "") {
        showToast("Bạn phải nhập lý do để hủy đơn hàng.");
        if (reasonInput) reasonInput.focus();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ orderId: orderToCancel, status: "Đã hủy" }).toString()
        });
        if (!res.ok) throw new Error("API lỗi");
    } catch {
        const orders = JSON.parse(localStorage.getItem("DonHang") || "[]");
        const idx = orders.findIndex(o => o.orderId === orderToCancel);
        if (idx > -1) { 
            orders[idx].status = "Đã hủy"; 
            orders[idx].cancelReason = reason;
            localStorage.setItem("DonHang", JSON.stringify(orders)); 
        }
    }
    
    closeCancelOrderModal();
    showToast("Đã hủy đơn hàng thành công!");
    initProfilePage();
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadImageMap();
  await initDatabase();

  updateCartBadge();
  initCountdown();
  renderFlashSale();
  renderSuggestedProducts();

  const searchForm = document.getElementById("header-search-form");
  if (searchForm) {
    searchForm.onsubmit = handleSearch;
  }

  const path = window.location.pathname;
  if (path.includes("product-list.html")) {
    initListingPage();
  } else if (path.includes("product-detail.html")) {
    initDetailPage();
  } else if (path.includes("cart.html")) {
    initCartPage();
  } else if (path.includes("checkout.html")) {
    initCheckoutPage();
  } else if (path.includes("profile.html")) {
    initProfilePage();
  }
});
