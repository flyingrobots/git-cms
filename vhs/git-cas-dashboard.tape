Output "__GIT_CAS_OUTPUT__"

Set Shell "zsh"
Set FontSize 15
Set Width 1440
Set Height 900
Set Padding 16
Set TypingSpeed 36ms
Set Framerate 24

Type 'export PS1="$ "'
Enter
Sleep 200ms

Type 'cd "__GIT_CAS_SRC__"'
Enter
Sleep 400ms

Type 'node bin/git-cas.js vault dashboard --cwd ../repo'
Enter
Sleep 3500ms

Type 'j'
Sleep 900ms

Type 'j'
Sleep 900ms

Type 'k'
Sleep 900ms

Type 'q'
Sleep 500ms
