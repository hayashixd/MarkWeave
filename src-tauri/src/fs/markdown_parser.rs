use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

/// パース結果: 1つの Markdown ファイルから抽出されるメタデータ
#[derive(Debug, Clone, Serialize)]
pub struct ParsedMarkdown {
    pub title: Option<String>,
    pub frontmatter: HashMap<String, FrontmatterValue>,
    pub tags: Vec<TagEntry>,
    pub tasks: Vec<TaskEntry>,
    pub links: Vec<LinkEntry>,
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct FrontmatterValue {
    pub raw: String,
    pub num: Option<f64>,
    pub bool_val: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TagEntry {
    pub tag: String,
    pub source: TagSource,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum TagSource {
    Frontmatter,
    Inline,
}

impl std::fmt::Display for TagSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TagSource::Frontmatter => write!(f, "frontmatter"),
            TagSource::Inline => write!(f, "inline"),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskEntry {
    pub text: String,
    pub checked: bool,
    pub line_number: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkEntry {
    pub target_name: String,
    pub link_type: LinkType,
    pub display_text: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum LinkType {
    Wiki,
    Markdown,
    External,
}

impl std::fmt::Display for LinkType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LinkType::Wiki => write!(f, "wiki"),
            LinkType::Markdown => write!(f, "markdown"),
            LinkType::External => write!(f, "external"),
        }
    }
}

/// Markdown ファイルの内容をパースしてメタデータを抽出する
pub fn parse_markdown(content: &str, _file_path: &Path) -> ParsedMarkdown {
    let lines: Vec<&str> = content.lines().collect();
    let mut result = ParsedMarkdown {
        title: None,
        frontmatter: HashMap::new(),
        tags: Vec::new(),
        tasks: Vec::new(),
        links: Vec::new(),
        word_count: 0,
    };

    let mut body_start = 0;
    let mut in_code_block = false;

    // YAML Front Matter のパース
    if !lines.is_empty() && lines[0].trim() == "---" {
        if let Some(end) = lines[1..].iter().position(|l| l.trim() == "---") {
            let fm_lines = &lines[1..=end];
            parse_frontmatter(fm_lines, &mut result);
            body_start = end + 2;
        }
    }

    // 本文のパース
    for (idx, line) in lines.iter().enumerate() {
        let line_number = idx + 1;

        // コードブロックの開始/終了判定
        if line.trim_start().starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }

        if in_code_block {
            continue;
        }

        // 本文領域のみ処理
        if idx < body_start {
            continue;
        }

        // タイトル抽出（最初の H1）
        if result.title.is_none() && result.frontmatter.get("title").is_none() {
            if let Some(h1) = line.strip_prefix("# ") {
                result.title = Some(h1.trim().to_string());
            }
        }

        // タスクリスト抽出
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
            result.tasks.push(TaskEntry {
                text: trimmed[6..].trim().to_string(),
                checked: true,
                line_number,
            });
        } else if trimmed.starts_with("- [ ] ") {
            result.tasks.push(TaskEntry {
                text: trimmed[6..].trim().to_string(),
                checked: false,
                line_number,
            });
        }

        // インラインタグ抽出（#tag パターン）
        extract_inline_tags(line, &mut result.tags);

        // リンク抽出
        extract_links(line, &mut result.links);
    }

    // frontmatter の title をセット
    if result.title.is_none() {
        if let Some(fm_title) = result.frontmatter.get("title") {
            result.title = Some(fm_title.raw.clone());
        }
    }

    // 単語数カウント（本文のみ）
    result.word_count = count_words(&lines[body_start..]);

    result
}

/// YAML Front Matter をパースする（簡易パーサー）
fn parse_frontmatter(lines: &[&str], result: &mut ParsedMarkdown) {
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed == "---" {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_string();
            let value_str = value.trim().to_string();

            if key == "tags" {
                // tags: [tag1, tag2] or tags: tag1
                let tag_str = value_str.trim_start_matches('[').trim_end_matches(']');
                for tag in tag_str.split(',') {
                    let tag = tag.trim().trim_matches('"').trim_matches('\'').to_string();
                    if !tag.is_empty() {
                        result.tags.push(TagEntry {
                            tag,
                            source: TagSource::Frontmatter,
                        });
                    }
                }
            }

            let num: Option<f64> = value_str.parse().ok();
            let bool_val = match value_str.as_str() {
                "true" => Some(true),
                "false" => Some(false),
                _ => None,
            };

            result.frontmatter.insert(
                key,
                FrontmatterValue {
                    raw: value_str,
                    num,
                    bool_val,
                },
            );
        }
    }
}

/// インラインタグ（#tag）を抽出
fn extract_inline_tags(line: &str, tags: &mut Vec<TagEntry>) {
    let mut chars = line.char_indices().peekable();
    while let Some((i, ch)) = chars.next() {
        if ch == '#' {
            // # の前が空白またはBOLであることを確認
            if i > 0 {
                let prev = line.as_bytes()[i - 1];
                if prev != b' ' && prev != b'\t' {
                    continue;
                }
            }
            // 見出し（## 等）を除外
            if chars.peek().map_or(true, |(_, c)| *c == '#' || *c == ' ') {
                continue;
            }
            // タグ名を収集
            let start = i + 1;
            let mut end = start;
            for (j, c) in chars.by_ref() {
                if c.is_alphanumeric() || c == '-' || c == '_' {
                    end = j + c.len_utf8();
                } else {
                    break;
                }
            }
            if end > start {
                let tag = &line[start..end];
                if !tags.iter().any(|t| t.tag == tag && t.source == TagSource::Inline) {
                    tags.push(TagEntry {
                        tag: tag.to_string(),
                        source: TagSource::Inline,
                    });
                }
            }
        }
    }
}

/// リンクを抽出（Wikiリンク + Markdown リンク）
fn extract_links(line: &str, links: &mut Vec<LinkEntry>) {
    // Wikiリンク: [[target]] or [[target|display]]
    let mut rest = line;
    while let Some(start) = rest.find("[[") {
        let after = &rest[start + 2..];
        if let Some(end) = after.find("]]") {
            let inner = &after[..end];
            let (target, display) = if let Some((t, d)) = inner.split_once('|') {
                (t.trim().to_string(), Some(d.trim().to_string()))
            } else {
                (inner.trim().to_string(), None)
            };
            if !target.is_empty() {
                links.push(LinkEntry {
                    target_name: target,
                    link_type: LinkType::Wiki,
                    display_text: display,
                    url: None,
                });
            }
            rest = &after[end + 2..];
        } else {
            break;
        }
    }

    // Markdown リンク: [display](url)
    let mut rest = line;
    while let Some(start) = rest.find("](") {
        let before = &rest[..start];
        if let Some(bracket_start) = before.rfind('[') {
            // [[wiki]] リンクでないことを確認
            if bracket_start > 0 && rest.as_bytes()[bracket_start - 1] == b'[' {
                rest = &rest[start + 2..];
                continue;
            }
            let display = &before[bracket_start + 1..];
            let after = &rest[start + 2..];
            if let Some(paren_end) = after.find(')') {
                let url = &after[..paren_end];
                if !url.is_empty() {
                    let (link_type, target_name) = classify_link(url);
                    links.push(LinkEntry {
                        target_name,
                        link_type,
                        display_text: if display.is_empty() {
                            None
                        } else {
                            Some(display.to_string())
                        },
                        url: Some(url.to_string()),
                    });
                }
                rest = &after[paren_end + 1..];
            } else {
                break;
            }
        } else {
            rest = &rest[start + 2..];
        }
    }
}

/// リンクURLからリンク種別を判定
fn classify_link(url: &str) -> (LinkType, String) {
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:") {
        (LinkType::External, url.to_string())
    } else {
        let name = Path::new(url)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| url.to_string());
        (LinkType::Markdown, name)
    }
}

/// 単語数カウント（日本語対応: 文字数ベース）
fn count_words(lines: &[&str]) -> usize {
    let mut count = 0;
    for line in lines {
        for ch in line.chars() {
            if ch.is_alphanumeric() {
                count += 1;
            }
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_frontmatter() {
        let content = r#"---
title: テストノート
tags: [project, work]
status: draft
priority: 3
---

# 本文見出し

本文のテキスト。
"#;
        let result = parse_markdown(content, &PathBuf::from("test.md"));

        assert_eq!(result.title, Some("テストノート".to_string()));
        assert_eq!(result.frontmatter.get("status").unwrap().raw, "draft");
        assert_eq!(result.frontmatter.get("priority").unwrap().num, Some(3.0));

        let fm_tags: Vec<&str> = result
            .tags
            .iter()
            .filter(|t| t.source == TagSource::Frontmatter)
            .map(|t| t.tag.as_str())
            .collect();
        assert_eq!(fm_tags, vec!["project", "work"]);
    }

    #[test]
    fn test_parse_tasks() {
        let content = "# タスクリスト\n\n- [x] 完了タスク\n- [ ] 未完了タスク\n- [X] もう一つの完了タスク\n";
        let result = parse_markdown(content, &PathBuf::from("test.md"));
        assert_eq!(result.tasks.len(), 3);
        assert!(result.tasks[0].checked);
        assert!(!result.tasks[1].checked);
        assert!(result.tasks[2].checked);
    }

    #[test]
    fn test_parse_wikilinks() {
        let content = "[[target-note]] and [[display|shown text]]";
        let result = parse_markdown(content, &PathBuf::from("test.md"));
        assert_eq!(result.links.len(), 2);
        assert_eq!(result.links[0].target_name, "target-note");
        assert_eq!(result.links[0].link_type, LinkType::Wiki);
        assert_eq!(result.links[1].target_name, "display");
        assert_eq!(
            result.links[1].display_text,
            Some("shown text".to_string())
        );
    }

    #[test]
    fn test_parse_markdown_links() {
        let content = "[click here](./other-note.md) and [Google](https://google.com)";
        let result = parse_markdown(content, &PathBuf::from("test.md"));
        assert_eq!(result.links.len(), 2);
        assert_eq!(result.links[0].link_type, LinkType::Markdown);
        assert_eq!(result.links[0].target_name, "other-note");
        assert_eq!(result.links[1].link_type, LinkType::External);
    }

    #[test]
    fn test_inline_tags() {
        let content = "This is #project and #work-related text";
        let result = parse_markdown(content, &PathBuf::from("test.md"));
        let inline_tags: Vec<&str> = result
            .tags
            .iter()
            .filter(|t| t.source == TagSource::Inline)
            .map(|t| t.tag.as_str())
            .collect();
        assert_eq!(inline_tags, vec!["project", "work-related"]);
    }

    #[test]
    fn test_title_from_h1() {
        let content = "# My Title\n\nBody text";
        let result = parse_markdown(content, &PathBuf::from("test.md"));
        assert_eq!(result.title, Some("My Title".to_string()));
    }
}
