Output "__GIT_CAS_OUTPUT__"

Set Shell "zsh"
Set FontSize 16
Set Width 1200
Set Height 720
Set Padding 16
Set TypingSpeed 36ms
Set Framerate 24

Type 'export PS1="$ "'
Enter
Sleep 200ms

Type 'cd "__GIT_CAS_SRC__"'
Enter
Sleep 400ms

Type 'node bin/git-cas.js inspect --slug demo/hello --cwd ../repo | cat'
Enter
Sleep 2s
