# Bookoo Mini (OOKOO-Firmware-Fix) – Decaid-Plugin

Ein Bookoo-Firmware-Update hat bei manchen Waagen den ersten Buchstaben des
Bluetooth-Namens abgeschnitten („OOKOO…“ statt „BOOKOO…“). Decaid erkennt
diese Waagen deshalb nicht mehr. Dieses Plugin übernimmt genau diese Waagen
und spricht das unveränderte Bookoo-Protokoll (Service 0x0FFE, Gewicht über
0xFF11, Befehle über 0xFF12), portiert aus Decaids eingebautem Bookoo-Treiber.

Korrekt benannte Bookoo-Waagen werden weiter vom eingebauten Treiber bedient,
weil das Plugin nur auf Namen reagiert, die mit „OOKOO“ beginnen.

Unterstützt: Gewicht, Akkustand, Tara, Timer starten/stoppen/zurücksetzen.

## Voraussetzung

Eine Decaid-Version mit Bluetooth-Treibern für Plugins (runtime-v2,
`host.devices.bindDriver`). Laut Skale-Plugin ist das ab Decaid-main vom
13.10.2026 vorhanden; ältere stabile Versionen lehnen das Plugin ab.

## Installation

ZIP-Datei in Decaid über „Plugin aus ZIP installieren“ hinzufügen, Plugin
aktivieren und die Bluetooth-Berechtigung erlauben. Danach die Waage einschalten
und in Decaid nach Geräten suchen.
