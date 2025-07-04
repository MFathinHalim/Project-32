let lastUrl = "";
let warninginput = false;

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

async function checkQuery(query) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "checkQuery", query }, (response) => {
      if (response && response.answer) {
        resolve(response.answer.toLowerCase().trim());
      } else {
        resolve(null);
      }
    });
  });
}

function injectVoiceScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-voice.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

function speakFromPage(text) {
  window.postMessage({ type: "SPEAK_TEXT", text }, "*");
}

injectVoiceScript();

const checkUrl = async () => {
  let url = new URL(window.location.href);
  let currentUrl = url.hostname;

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    let searchParams = new URLSearchParams(window.location.search);
    let query = searchParams.get("q") ? searchParams.get("q") : currentUrl;

    const queryResponse = await checkQuery(query);
    if (!queryResponse) return;

    if (queryResponse.startsWith("[n]")) {
      chrome.storage.local.get("parentEmail", ({ parentEmail }) => {
        let message = queryResponse.replace("[n] ", "").replace("\n", "");
        Swal.fire({
          title: "Peringatan!",
          text: message,
          imageUrl:
            "https://media.tenor.com/5ExGc8sRRAYAAAAj/mythikore-anime-girl.gif",
          showCancelButton: true,
          confirmButtonText: "Lanjut",
          cancelButtonText: "Kembali ke Google",
          didOpen: () => {
            document.addEventListener("mousemove", () => {
              speakFromPage(message);
            });
          },
        }).then((result) => {
          if (result.isConfirmed) {
            fetch("https://api.emailjs.com/api/v1.0/email/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                service_id: "service_hhk9rbm",
                template_id: "template_dbv49pl",
                user_id: "8IZRuXPbGtWqznOeV",
                template_params: {
                  to_email: parentEmail,
                  email: parentEmail,
                  query: query,
                  waktu: new Date().toLocaleString(),
                },
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("Gagal kirim email");
                return res.text();
              })
              .then((text) => {
                console.log("Email sukses terkirim:", text);
              })
              .catch((err) => {
                console.error("Email GAGAL:", err);
              });

            chrome.runtime.sendMessage({
              type: "logSearch",
              query,
              url: currentUrl,
            });
            window.location.href =
              "https://www.youtube.com/watch?v=rQ9YQJ3JpWw";
          } else {
            window.location.href = "https://www.google.com";
          }
        });
      });
    } else if (queryResponse.startsWith("[a]")) {
      Swal.fire({
        title: "Peringatan!",
        text: "web ini kebanyakan digunakan aman, tapi memiliki resiko sedikit",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Lanjut",
        cancelButtonText: "Kembali ke Google",
      }).then((result) => {
        if (result.isConfirmed) {
          chrome.runtime.sendMessage({
            type: "logSearch",
            query,
            url: currentUrl,
          });
        } else {
          window.location.href = "https://www.google.com";
        }
      });
    }
  }
};
checkUrl();

function monitorInputField(field) {
  if (field.dataset.watched === "true") return;
  field.dataset.watched = "true";

  const checkInput = debounce(() => {
    if (warninginput) return;

    let text = "";
    if (field.isContentEditable) {
      text = field.innerText?.trim();
    } else {
      text = field.value?.trim();
    }

    if (!text || text.length < 4) return;

    const prompt = `cobalah cek apa yang diketik user ini baik untuk ketikan anak anak atau tidak ${text}. kalau jelek cukup jawan [n] aja tanpa tambahan apa apa`;

    chrome.runtime.sendMessage({ type: "checkInput", prompt }, (response) => {
      if (!response) return;

      const answer = response.answer?.replaceAll("\n", "").trim();
      console.log("Response:", response);
      if (answer === "[n]") {
        chrome.storage.local.get("parentEmail", ({ parentEmail }) => {
          warninginput = true;

          Swal.fire({
            title: "Peringatan!",
            text: "JANGAN KETIK APA-APA YANG TIDAK PANTAS ATAU BERBAHAYA!",
            imageUrl:
              "https://media.tenor.com/5ExGc8sRRAYAAAAj/mythikore-anime.gif",
            showCancelButton: true,
            confirmButtonText: "Lanjut",
            cancelButtonText: "Kembali ke Google",
            didOpen: () => {
              speakWithVoice("Peringatan! Jangan ketik hal yang tidak pantas.");
            },
          }).then((result) => {
            if (result.isConfirmed) {
              chrome.runtime.sendMessage({
                type: "logSearch",
                query: text,
                url: window.location.hostname,
              });

              fetch("https://api.emailjs.com/api/v1.0/email/send", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  service_id: "service_hhk9rbm",
                  template_id: "template_dbv49pl",
                  user_id: "8IZRuXPbGtWqznOeV",
                  template_params: {
                    to_email: parentEmail,
                    email: parentEmail,
                    query: `anak anda mencoba mengetik: ${text}`,
                    waktu: new Date().toLocaleString(),
                  },
                }),
              })
                .then((res) => {
                  if (!res.ok) throw new Error("Gagal kirim email");
                  return res.text();
                })
                .then((text) => {
                  console.log("Email sukses terkirim:", text);
                })
                .catch((err) => {
                  console.error("Email GAGAL:", err);
                });
            } else {
              window.location.href = "https://www.google.com";
            }
          });
        });
      }
    });
  }, 500);

  if (field.isContentEditable) {
    field.addEventListener("keyup", checkInput);
    field.addEventListener("paste", checkInput);
  } else {
    field.addEventListener("input", checkInput);
  }
}

function scanInputs() {
  const fields = document.querySelectorAll(
    "input[type='text'], textarea, [contenteditable='true']"
  );
  fields.forEach(monitorInputField);
}

scanInputs();

// Monitor elemen input baru
const observerInputs = new MutationObserver(scanInputs);
observerInputs.observe(document.body, { childList: true, subtree: true });

// Monitor perubahan URL
const observerUrl = new MutationObserver(checkUrl);
observerUrl.observe(document.body, { childList: true, subtree: true });
