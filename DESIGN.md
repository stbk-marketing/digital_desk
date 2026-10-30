---
version: alpha
name: Kühl Workspace
description: Grüner Schreibtisch mit warmen Flächen für die gemeinsame Aufgabenplanung.
colors:
    background: '#f3eee4'
    foreground: '#18352f'
    card: '#faf7f0'
    primary: '#287451'
    primaryForeground: '#ffffff'
    sidebar: '#183b2f'
    sidebarForeground: '#f5f5ec'
    mutedForeground: '#626e69'
    border: '#ded9cd'
typography:
    sans:
        fontFamily: "'Circular Std', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    utility:
        fontFamily: "'Circular Std', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
rounded:
    DEFAULT: '0.5rem'
    card: '0.4375rem'
    section: '0.75rem'
    panel: '0.875rem'
spacing:
    sectionGap: '1.25rem'
    cardGap: '0.6875rem'
components:
    button:
        height: '2.25rem'
        backgroundColor: '{colors.primary}'
        textColor: '{colors.primaryForeground}'
    card:
        backgroundColor: '{colors.card}'
        textColor: '{colors.foreground}'
    dialog:
        rounded: '0.9375rem'
        backgroundColor: '{colors.background}'
    sidebar:
        backgroundColor: '{colors.sidebar}'
        textColor: '{colors.sidebarForeground}'
    hint:
        textColor: '{colors.mutedForeground}'
    input:
        textColor: '{colors.foreground}'
    separator:
        backgroundColor: '{colors.border}'
---

# Kühl Workspace Design System

## Overview

Die vom Nutzer am 30.10.2026 gelieferte Vorlage „Produktivitäts-Dashboard im Grünen Stil“ ist die visuelle Referenz. Produktoberfläche für das Team der Stadtbäckerei Kühl: Gedanken schnell erfassen, Aufgaben zuordnen und gemeinsam planen. Die vorhandenen Abläufe aus README.md und docs/ARCHITEKTUR.md bleiben maßgeblich.

Die charakteristische Kombination besteht aus dunkelgrüner Navigation mit zurückhaltender Blattzeichnung und einem warmen, cremefarbenen Schreibtisch. Funktionale Bedienelemente bleiben ruhig. Keine Marketingelemente oder erfundenen Dashboard-Kennzahlen. Deutsch, de-DE und Europe/Berlin; bestehende Datumsspeicherung bleibt unverändert.

Runtime-Eigentümer ist resources/css/workspace.css. Die dortigen semantischen Variablen überschreiben die Basistokens innerhalb .workspace-shell, .workspace-overlay und .workspace-navigation. Solange der Workspace gerendert wird, vererbt body:has(.workspace-shell) dieselben Werte auch an Menüs, Dialoge und andere Portale. Tailwind konsumiert sie über die bestehenden @theme-Zuordnungen in resources/css/app.css. Dieses Dokument spiegelt die implementierten Werte; Änderungen erfolgen gemeinsam mit dem Stylesheet. Anmeldung und Kontoeinstellungen behalten ihr bestehendes Theme.

## Colors

Creme als Arbeitsfläche, nahezu weiße Karten, dunkles Grün für Text und Aktionen. Gedämpfte Farben am linken Kartenrand helfen beim Scannen; der Projektname bleibt als Text erhalten. Fristen verwenden zusätzlich Kalendericon und Datum, fällige Aufgaben einen warmen Warnhintergrund. Die Workspace-Referenz verwendet bewusst ein helles Arbeitsthema auch bei dunkler Systemeinstellung. Native Auswahl- und Datumsfenster bleiben plattformgesteuert.

## Typography

Vorhandener Sans-Stack mit System-Fallback, ohne zusätzliche Font-Netzwerkzugriffe. Überschriften 25–34px, Abschnittstitel 14–16px, Karten 13–14px. Lange Titel umbrechen und wachsen mit dem Inhalt. Zahlen in Datumsmarken verwenden tabellarische Ziffern. Keine zusätzlichen Schmuckschriften in der Arbeitsoberfläche.

## Layout

Navigation 13.5rem breit, einklappbar; mobil über das vorhandene Sidebar-Sheet. Kopf mit Begrüßung, Datum und Aktionen. Großes, mitwachsendes Eingabefeld mit Termin-, Personen- und Projektzuordnung. Darunter einklappbare Abschnitte mit responsivem Kartengitter (Mindestbreite 275px); unter 640px eine Spalte. Leere Überfällig-Gruppe wird ausgelassen. Andere leere Gruppen erklären ihren Zustand.

Der nichtmodale Detailbereich wird ab 1280px neben dem Inhalt reserviert. Darunter liegt er darüber; mobil mit 8px Rand und eigenem Scrollbereich. Dokument-Scrolling bleibt erhalten. Suche und Filter sind kurze, zugängliche Modals.

## Elevation & Depth

Dezente Schatten trennen Eingabe, Karten und Detailbereich. Blätter sind ausschließlich Dekoration und beeinträchtigen weder Kontrast noch Zeigerinteraktion. Arbeitsinhalte erhalten keine fotografischen Hintergründe.

## Shapes

Karten 7px Radius, Abschnitte 12px, Eingabe und Details 14px. Abgerundete Checkboxen und runde Abschnittszähler. Trennlinien sind warmgrau und zurückhaltend.

## Components

Bestehende Button-, Input-, Textarea-, NativeSelect-, Dialog-, Sheet-, Checkbox- und Collapsible-Primitives wiederverwenden. Fokus bleibt sichtbar; interaktive Flächen haben Hover- und Disabled-Zustände. Such- und Filterbuttons erhalten zugängliche Namen. Auswahlfilter tragen sichtbare Labels. Alle Dialoge lassen sich mit Escape schließen und geben den Fokus an ihren Auslöser zurück. Details bleiben bewusst nichtmodal.

Kartentitel bleiben direkt bearbeitbar und speichern automatisch. Datum, Person, Projekt, Zurückstellung, Notizen, Archiv und Verlauf werden im Detail bearbeitet. Lucide-Icons, in der Regel 14–20px. Reduzierte Bewegung deaktiviert Animationen. Fehler und lokale Entwürfe bleiben sichtbar und wiederholbar.

## Do's and Don'ts

- Die Vorlage durch Farben, Flächenteilung und Informationshierarchie wiedergeben.
- Konkrete Aufgaben und vorhandene Funktionen in den Mittelpunkt stellen.
- Lange Inhalte umbrechen und mobile Ansichten ohne horizontales Seitenscrolling halten.
- Keine Suche oder Filter dauerhaft über der Aufgabenliste ausbreiten.
- Keine fachliche Bedeutung ausschließlich durch Kartenfarben vermitteln.
